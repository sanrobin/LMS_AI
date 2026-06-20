"""
FastAPI application entry point.
Mounts all routers, serves static files, and renders Jinja2 templates.
"""

from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse

from app.config import STATIC_DIR, TEMPLATES_DIR
from app.database import engine, Base
from app.models import User  # noqa: F401 — needed for table creation
from app.auth.router import router as auth_router
from app.auth.dependencies import get_current_user
from app.routers.books import router as books_router
from app.routers.locations import router as locations_router
from app.routers.circulation import router as circulation_router
from app.routers.ai_assistant import router as ai_router

# ── Create database tables ──────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── FastAPI app ─────────────────────────────────────────────────────
app = FastAPI(
    title="Library Management System",
    description="Lightweight LMS for Raspberry Pi with AI-powered discovery",
    version="1.0.0",
)

# ── Mount static files ──────────────────────────────────────────────
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ── Templates ───────────────────────────────────────────────────────
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# ── Register API routers ────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(books_router)
app.include_router(locations_router)
app.include_router(circulation_router)
app.include_router(ai_router)


# ── Page routes ─────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Redirect to login page."""
    return RedirectResponse(url="/login")


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Render the login page."""
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Render the registration page."""
    return templates.TemplateResponse("register.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """
    Render the appropriate dashboard based on user role.
    Requires authentication — handled client-side via JS redirect.
    """
    return templates.TemplateResponse("student_dashboard.html", {"request": request})


@app.get("/librarian", response_class=HTMLResponse)
async def librarian_dashboard(request: Request):
    """
    Render the librarian dashboard.
    Requires librarian role — handled client-side via JS redirect.
    """
    return templates.TemplateResponse("librarian_dashboard.html", {"request": request})


# ── Health check ────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint for monitoring."""
    return {"status": "ok", "service": "Library Management System"}
