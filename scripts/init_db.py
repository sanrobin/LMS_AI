"""
Database initialization and seed script.
Creates tables, inserts sample data, and generates locations.csv.

Run:  python -m scripts.init_db
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base, SessionLocal
from app.models import User, Book, BookStatus, UserRole, BorrowHistory
from app.auth.utils import hash_password
from app.services.csv_service import upsert_location
from app.config import DATA_DIR

from datetime import datetime, timedelta, timezone


def init_database():
    """Create all tables."""
    print("📦 Creating database tables...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully.\n")


def seed_users(db):
    """Create default admin and sample student accounts."""
    print("👤 Seeding users...")

    users = [
        User(
            username="admin",
            password_hash=hash_password("admin123"),
            role=UserRole.librarian,
        ),
        User(
            username="student1",
            password_hash=hash_password("pass123"),
            role=UserRole.student,
        ),
        User(
            username="student2",
            password_hash=hash_password("pass123"),
            role=UserRole.student,
        ),
    ]

    for user in users:
        existing = db.query(User).filter(User.username == user.username).first()
        if not existing:
            db.add(user)
            print(f"   + Created user: {user.username} ({user.role.value})")
        else:
            print(f"   - Skipped (exists): {user.username}")

    db.commit()


def seed_books(db):
    """Insert sample books into the catalog."""
    print("\n📚 Seeding books...")

    books_data = [
        {"title": "Introduction to Algorithms", "author": "Thomas H. Cormen", "isbn": "9780262033848"},
        {"title": "Clean Code", "author": "Robert C. Martin", "isbn": "9780132350884"},
        {"title": "The Pragmatic Programmer", "author": "David Thomas & Andrew Hunt", "isbn": "9780135957059"},
        {"title": "Design Patterns", "author": "Erich Gamma et al.", "isbn": "9780201633610"},
        {"title": "Python Crash Course", "author": "Eric Matthes", "isbn": "9781593279288"},
        {"title": "Artificial Intelligence: A Modern Approach", "author": "Stuart Russell & Peter Norvig", "isbn": "9780134610993"},
        {"title": "The Art of Computer Programming", "author": "Donald Knuth", "isbn": "9780201896831"},
        {"title": "Structure and Interpretation of Computer Programs", "author": "Harold Abelson & Gerald Sussman", "isbn": "9780262510875"},
        {"title": "Database System Concepts", "author": "Abraham Silberschatz", "isbn": "9780078022159"},
        {"title": "Computer Networking: A Top-Down Approach", "author": "James Kurose & Keith Ross", "isbn": "9780133594140"},
        {"title": "Operating System Concepts", "author": "Abraham Silberschatz", "isbn": "9781118063330"},
        {"title": "Digital Design and Computer Architecture", "author": "David Harris & Sarah Harris", "isbn": "9780123944245"},
        {"title": "Discrete Mathematics and Its Applications", "author": "Kenneth Rosen", "isbn": "9780073383095"},
        {"title": "Linear Algebra and Its Applications", "author": "David C. Lay", "isbn": "9780321982384"},
        {"title": "Calculus: Early Transcendentals", "author": "James Stewart", "isbn": "9781285741550"},
        {"title": "To Kill a Mockingbird", "author": "Harper Lee", "isbn": "9780061120084"},
        {"title": "1984", "author": "George Orwell", "isbn": "9780451524935"},
        {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "isbn": "9780743273565"},
        {"title": "Pride and Prejudice", "author": "Jane Austen", "isbn": "9780141439518"},
        {"title": "Sapiens: A Brief History of Humankind", "author": "Yuval Noah Harari", "isbn": "9780062316097"},
    ]

    for bdata in books_data:
        existing = db.query(Book).filter(Book.isbn == bdata["isbn"]).first()
        if not existing:
            book = Book(**bdata, status=BookStatus.available)
            db.add(book)
            print(f"   + Added: {bdata['title']}")
        else:
            print(f"   - Skipped (exists): {bdata['title']}")

    db.commit()


def seed_locations():
    """Generate sample locations.csv with coordinates for the library floorplan."""
    print("\n🗺️  Seeding book locations (CSV)...")

    # Locations mapped to a 1000x700 pixel floorplan image
    # Organized by shelf sections of a typical library
    locations = [
        (1, 120, 150, "Shelf A1 - Computer Science"),
        (2, 120, 200, "Shelf A1 - Computer Science"),
        (3, 120, 250, "Shelf A1 - Computer Science"),
        (4, 120, 300, "Shelf A1 - Computer Science"),
        (5, 280, 150, "Shelf A2 - Programming"),
        (6, 280, 200, "Shelf A2 - Programming"),
        (7, 280, 250, "Shelf A2 - Programming"),
        (8, 280, 300, "Shelf A2 - Programming"),
        (9, 450, 150, "Shelf B1 - Databases & Networks"),
        (10, 450, 200, "Shelf B1 - Databases & Networks"),
        (11, 450, 250, "Shelf B1 - Databases & Networks"),
        (12, 450, 300, "Shelf B1 - Databases & Networks"),
        (13, 620, 150, "Shelf C1 - Mathematics"),
        (14, 620, 200, "Shelf C1 - Mathematics"),
        (15, 620, 250, "Shelf C1 - Mathematics"),
        (16, 780, 150, "Shelf D1 - Literature"),
        (17, 780, 200, "Shelf D1 - Literature"),
        (18, 780, 250, "Shelf D1 - Literature"),
        (19, 780, 300, "Shelf D1 - Literature"),
        (20, 450, 500, "Shelf E1 - Non-Fiction"),
    ]

    for book_id, x, y, shelf in locations:
        upsert_location(book_id, x, y, shelf)
        print(f"   + Book {book_id} → ({x}, {y}) @ {shelf}")

    print("✅ Locations CSV updated.\n")


def seed_sample_borrows(db):
    """Create a few sample borrow records for demo purposes."""
    print("📖 Seeding sample borrow records...")

    student1 = db.query(User).filter(User.username == "student1").first()
    student2 = db.query(User).filter(User.username == "student2").first()

    if not student1 or not student2:
        print("   - Skipped (users not found)")
        return

    now = datetime.now(timezone.utc)

    # Student 1 borrowed "Clean Code" 5 days ago
    book2 = db.query(Book).filter(Book.id == 2).first()
    if book2 and book2.status == BookStatus.available:
        borrow_date = now - timedelta(days=5)
        book2.status = BookStatus.borrowed
        book2.borrowed_by = student1.id
        book2.borrowed_date = borrow_date
        db.add(BorrowHistory(book_id=2, user_id=student1.id, borrow_date=borrow_date))
        print(f"   + student1 borrowed '{book2.title}' (5 days ago)")

    # Student 2 borrowed "1984" 20 days ago (overdue!)
    book17 = db.query(Book).filter(Book.id == 17).first()
    if book17 and book17.status == BookStatus.available:
        borrow_date = now - timedelta(days=20)
        book17.status = BookStatus.borrowed
        book17.borrowed_by = student2.id
        book17.borrowed_date = borrow_date
        db.add(BorrowHistory(book_id=17, user_id=student2.id, borrow_date=borrow_date))
        print(f"   + student2 borrowed '{book17.title}' (20 days ago - OVERDUE)")

    # Historical record: student1 borrowed and returned "Python Crash Course"
    book5 = db.query(Book).filter(Book.id == 5).first()
    if book5:
        borrow_date = now - timedelta(days=30)
        return_date = now - timedelta(days=23)
        db.add(BorrowHistory(
            book_id=5, user_id=student1.id,
            borrow_date=borrow_date, return_date=return_date,
            duration_days=7,
        ))
        print(f"   + student1 returned '{book5.title}' (7 days, completed)")

    db.commit()


def main():
    """Run the full initialization."""
    print("=" * 60)
    print("  Library Management System — Database Initialization")
    print("=" * 60)
    print()

    init_database()

    db = SessionLocal()
    try:
        seed_users(db)
        seed_books(db)
        seed_locations()
        seed_sample_borrows(db)
    finally:
        db.close()

    print("=" * 60)
    print("  ✅ Initialization complete!")
    print()
    print("  Default accounts:")
    print("    Librarian:  admin / admin123")
    print("    Student:    student1 / pass123")
    print("    Student:    student2 / pass123")
    print()
    print("  Start the server:")
    print("    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    print("=" * 60)


if __name__ == "__main__":
    main()
