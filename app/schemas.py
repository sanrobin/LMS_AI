"""
Pydantic schemas for request validation and response serialization.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Auth Schemas ────────────────────────────────────────────────────

class UserRegister(BaseModel):
    """Registration request."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4, max_length=128)
    role: str = Field(default="student", pattern="^(student|librarian)$")


class UserLogin(BaseModel):
    """Login request."""
    username: str
    password: str


class UserResponse(BaseModel):
    """Public user info returned by API."""
    id: int
    username: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Book Schemas ────────────────────────────────────────────────────

class BookCreate(BaseModel):
    """Create a new book."""
    title: str = Field(..., min_length=1, max_length=200)
    author: str = Field(..., min_length=1, max_length=150)
    isbn: Optional[str] = Field(None, max_length=13)


class BookUpdate(BaseModel):
    """Update book fields (all optional)."""
    title: Optional[str] = Field(None, max_length=200)
    author: Optional[str] = Field(None, max_length=150)
    isbn: Optional[str] = Field(None, max_length=13)


class BookResponse(BaseModel):
    """Book data returned by API."""
    id: int
    title: str
    author: str
    isbn: Optional[str] = None
    status: str
    borrowed_by: Optional[int] = None
    borrowed_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class BookDetailResponse(BookResponse):
    """Book detail including location data from CSV."""
    x_coord: Optional[float] = None
    y_coord: Optional[float] = None
    shelf_name: Optional[str] = None
    borrower_name: Optional[str] = None


# ── Location Schemas ────────────────────────────────────────────────

class LocationUpdate(BaseModel):
    """Update book location in CSV."""
    x_coord: float = Field(..., ge=0)
    y_coord: float = Field(..., ge=0)
    shelf_name: str = Field(..., min_length=1, max_length=50)


class LocationResponse(BaseModel):
    """Location data from CSV."""
    book_id: int
    x_coord: float
    y_coord: float
    shelf_name: str


# ── Circulation Schemas ─────────────────────────────────────────────

class CirculationRecord(BaseModel):
    """A single circulation record for the librarian table."""
    history_id: int
    book_id: int
    book_title: str
    user_id: int
    username: str
    borrow_date: datetime
    return_date: Optional[datetime] = None
    duration_days: Optional[int] = None
    is_overdue: bool = False

    class Config:
        from_attributes = True


class BorrowedBookResponse(BaseModel):
    """Student's view of their borrowed book."""
    book_id: int
    title: str
    author: str
    borrow_date: datetime
    days_held: int


# ── AI Assistant Schemas ────────────────────────────────────────────

class ChatRequest(BaseModel):
    """AI chat request."""
    message: str = Field(..., min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    """AI chat response."""
    reply: str
    sources: Optional[list[str]] = None
