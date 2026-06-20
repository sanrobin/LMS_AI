"""
Application configuration.
Loads environment variables from .env file and exposes them as typed settings.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ── Resolve project paths ──────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
LOCATIONS_CSV = DATA_DIR / "locations.csv"

# ── Load .env if present ───────────────────────────────────────────
load_dotenv(BASE_DIR / ".env")

# ── Security / JWT ─────────────────────────────────────────────────
SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-insecure-key-change-me")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# ── Database ───────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'library.db'}")

# ── Google Gemini API ──────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# ── Google Custom Search Engine ────────────────────────────────────
CSE_API_KEY: str = os.getenv("CSE_API_KEY", "")
CSE_ENGINE_ID: str = os.getenv("CSE_ENGINE_ID", "")

# ── App Defaults ───────────────────────────────────────────────────
MAX_BORROW_LIMIT: int = 5          # Max books a student can borrow at once
OVERDUE_DAYS: int = 14             # Loan period before a book is flagged overdue
