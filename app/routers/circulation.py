"""
Circulation routes — borrow, return, and history tracking.
Students can borrow/return books; Librarians can view the full circulation table.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, BookStatus, BorrowHistory, User
from app.schemas import CirculationRecord, BorrowedBookResponse
from app.auth.dependencies import get_current_user, require_role
from app.config import MAX_BORROW_LIMIT, OVERDUE_DAYS

router = APIRouter(prefix="/api", tags=["Circulation"])


@router.post("/borrow/{book_id}", status_code=200)
def borrow_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Borrow a book (Student).
    Enforces borrow limit and checks availability.
    """
    # Check book exists
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")

    if book.status == BookStatus.borrowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This book is already borrowed by someone else.",
        )

    # Check borrow limit
    active_borrows = db.query(Book).filter(
        Book.borrowed_by == current_user.id,
        Book.status == BookStatus.borrowed,
    ).count()

    if active_borrows >= MAX_BORROW_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have reached the maximum borrow limit of {MAX_BORROW_LIMIT} books.",
        )

    # Borrow the book (use naive UTC — SQLite doesn't store timezone info)
    now = datetime.utcnow()
    book.status = BookStatus.borrowed
    book.borrowed_by = current_user.id
    book.borrowed_date = now

    # Create history record
    history = BorrowHistory(
        book_id=book.id,
        user_id=current_user.id,
        borrow_date=now,
    )
    db.add(history)
    db.commit()

    return {
        "message": f"Successfully borrowed '{book.title}'.",
        "book_id": book.id,
        "due_date": (now.replace(tzinfo=None).__str__()[:10]),
    }


@router.post("/return/{book_id}", status_code=200)
def return_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a borrowed book (Student).
    Calculates duration and updates history.
    """
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")

    if book.status != BookStatus.borrowed or book.borrowed_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have not borrowed this book.",
        )

    now = datetime.utcnow()

    # Find the active history record and close it
    history = db.query(BorrowHistory).filter(
        BorrowHistory.book_id == book.id,
        BorrowHistory.user_id == current_user.id,
        BorrowHistory.return_date.is_(None),
    ).order_by(BorrowHistory.borrow_date.desc()).first()

    if history:
        history.return_date = now
        history.duration_days = (now - history.borrow_date).days

    # Reset book status
    book.status = BookStatus.available
    book.borrowed_by = None
    book.borrowed_date = None

    db.commit()

    return {
        "message": f"Successfully returned '{book.title}'.",
        "duration_days": history.duration_days if history else 0,
    }


@router.get("/circulation", response_model=list[CirculationRecord])
def get_circulation(
    sort_by: str = Query(default="duration", description="Sort by: duration, date, user"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _librarian: User = Depends(require_role("librarian")),
):
    """
    Full circulation table for librarians.
    Shows all active and past borrow records, sortable by duration.
    """
    records = db.query(BorrowHistory).all()
    now = datetime.utcnow()

    result = []
    for rec in records:
        # Calculate current duration for active borrows
        if rec.return_date:
            duration = rec.duration_days or 0
        else:
            duration = (now - rec.borrow_date).days

        is_overdue = (not rec.return_date) and (duration > OVERDUE_DAYS)

        result.append(CirculationRecord(
            history_id=rec.id,
            book_id=rec.book_id,
            book_title=rec.book.title if rec.book else "Unknown",
            user_id=rec.user_id,
            username=rec.user.username if rec.user else "Unknown",
            borrow_date=rec.borrow_date,
            return_date=rec.return_date,
            duration_days=duration,
            is_overdue=is_overdue,
        ))

    # Sort
    reverse = sort_order == "desc"
    if sort_by == "duration":
        result.sort(key=lambda r: r.duration_days or 0, reverse=reverse)
    elif sort_by == "date":
        result.sort(key=lambda r: r.borrow_date, reverse=reverse)
    elif sort_by == "user":
        result.sort(key=lambda r: r.username.lower(), reverse=reverse)

    return result


@router.get("/my-books", response_model=list[BorrowedBookResponse])
def get_my_books(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current user's actively borrowed books."""
    books = db.query(Book).filter(
        Book.borrowed_by == current_user.id,
        Book.status == BookStatus.borrowed,
    ).all()

    now = datetime.utcnow()
    result = []
    for book in books:
        days_held = (now - book.borrowed_date).days if book.borrowed_date else 0
        result.append(BorrowedBookResponse(
            book_id=book.id,
            title=book.title,
            author=book.author,
            borrow_date=book.borrowed_date,
            days_held=days_held,
        ))

    return result
