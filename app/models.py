"""
SQLAlchemy ORM models for Users, Books, and BorrowHistory.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from app.database import Base


# ── Enums ───────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    """User roles — extensible for future roles like 'admin', 'faculty'."""
    student = "student"
    librarian = "librarian"


class BookStatus(str, enum.Enum):
    """Book availability status."""
    available = "available"
    borrowed = "borrowed"


# ── Models ──────────────────────────────────────────────────────────

class User(Base):
    """
    Library user. Supports students and librarians.
    The auth system is modular — swap the password_hash check for
    OAuth/LDAP by modifying auth/utils.py only.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.student, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    borrowed_books = relationship("Book", back_populates="borrower", lazy="selectin")
    borrow_history = relationship("BorrowHistory", back_populates="user", lazy="selectin")

    def __repr__(self):
        return f"<User {self.username} ({self.role.value})>"


class Book(Base):
    """
    Book record. Status tracks current availability.
    Location data (x/y coords, shelf) is stored separately in locations.csv.
    """
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    author = Column(String(150), nullable=False, index=True)
    isbn = Column(String(13), unique=True, nullable=True)
    status = Column(SAEnum(BookStatus), default=BookStatus.available, nullable=False)
    borrowed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    borrowed_date = Column(DateTime, nullable=True)

    # Relationships
    borrower = relationship("User", back_populates="borrowed_books", lazy="selectin")
    history = relationship("BorrowHistory", back_populates="book", lazy="selectin")

    def __repr__(self):
        return f"<Book {self.title} by {self.author}>"


class BorrowHistory(Base):
    """
    Historical record of every borrow/return transaction.
    duration_days is computed on return.
    """
    __tablename__ = "borrow_history"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    borrow_date = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    return_date = Column(DateTime, nullable=True)
    duration_days = Column(Integer, nullable=True)

    # Relationships
    book = relationship("Book", back_populates="history", lazy="selectin")
    user = relationship("User", back_populates="borrow_history", lazy="selectin")

    def __repr__(self):
        return f"<BorrowHistory book={self.book_id} user={self.user_id}>"
