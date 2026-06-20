"""
SQLite database engine and session management.
Uses SQLAlchemy with synchronous SQLite — ideal for Raspberry Pi's single-disk I/O.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import DATABASE_URL, DATA_DIR

# ── Ensure the data directory exists ────────────────────────────────
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Engine ──────────────────────────────────────────────────────────
# check_same_thread=False is required for FastAPI's threaded request handling
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,  # Set True for SQL debug logging
)

# ── Session factory ─────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── Declarative base for ORM models ────────────────────────────────
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that provides a database session per request.
    Automatically closes the session when the request is done.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
