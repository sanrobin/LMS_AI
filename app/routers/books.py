"""
Book CRUD routes.
Librarians can create, update, and delete books.
All authenticated users can search and view books.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import Book, BookStatus, User
from app.schemas import BookCreate, BookUpdate, BookResponse, BookDetailResponse
from app.auth.dependencies import get_current_user, require_role
from app.services import csv_service

router = APIRouter(prefix="/api/books", tags=["Books"])


@router.get("", response_model=list[BookResponse])
def list_books(
    q: str = Query(default="", description="Search query (title, author, or ISBN)"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    List all books with optional search filtering.
    Supports pagination via page & limit query params.
    """
    query = db.query(Book)

    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                Book.title.ilike(search_term),
                Book.author.ilike(search_term),
                Book.isbn.ilike(search_term),
            )
        )

    total = query.count()
    books = query.offset((page - 1) * limit).limit(limit).all()

    return books


@router.get("/{book_id}", response_model=BookDetailResponse)
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Get a single book with its location data from CSV.
    """
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")

    # Enrich with location data from CSV
    location = None
    if book.genre:
        location = csv_service.get_location(book.genre)
    
    borrower_name = book.borrower.username if book.borrower else None

    response = BookDetailResponse(
        id=book.id,
        title=book.title,
        author=book.author,
        isbn=book.isbn,
        genre=book.genre,
        status=book.status.value,
        borrowed_by=book.borrowed_by,
        borrowed_date=book.borrowed_date,
        borrower_name=borrower_name,
        x_coord=location["x_coord"] if location else None,
        y_coord=location["y_coord"] if location else None,
        shelf_name=location["shelf_name"] if location else None,
    )

    return response


@router.post("", response_model=BookResponse, status_code=201)
def create_book(
    data: BookCreate,
    db: Session = Depends(get_db),
    _librarian: User = Depends(require_role("librarian")),
):
    """Create a new book (Librarian only)."""
    # Check for duplicate ISBN
    if data.isbn:
        existing = db.query(Book).filter(Book.isbn == data.isbn).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A book with ISBN {data.isbn} already exists.",
            )

    book = Book(
        title=data.title,
        author=data.author,
        isbn=data.isbn,
        genre=data.genre,
        status=BookStatus.available,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book


@router.put("/{book_id}", response_model=BookResponse)
def update_book(
    book_id: int,
    data: BookUpdate,
    db: Session = Depends(get_db),
    _librarian: User = Depends(require_role("librarian")),
):
    """Update a book's metadata (Librarian only)."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")

    if data.title is not None:
        book.title = data.title
    if data.author is not None:
        book.author = data.author
    if data.isbn is not None:
        # Check for duplicate ISBN (exclude current book)
        existing = db.query(Book).filter(Book.isbn == data.isbn, Book.id != book_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A book with ISBN {data.isbn} already exists.",
            )
        book.isbn = data.isbn
    if data.genre is not None:
        book.genre = data.genre

    db.commit()
    db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=204)
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    _librarian: User = Depends(require_role("librarian")),
):
    """Delete a book and its CSV location entry (Librarian only)."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")

    if book.status == BookStatus.borrowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a book that is currently borrowed. Return it first.",
        )

    # Note: We do not remove the location from CSV because locations are tied to genres, not individual books.

    db.delete(book)
    db.commit()
    return None
