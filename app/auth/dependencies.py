"""
FastAPI dependencies for authentication and authorization.
Extracts JWT from cookies or Authorization header, validates the user,
and enforces role-based access control.
"""

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth.utils import decode_access_token


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Dependency: Extract and validate the current user from JWT.
    
    Checks (in order):
        1. httpOnly cookie named 'access_token'
        2. Authorization: Bearer <token> header
    
    Raises 401 if no valid token or user found.
    """
    token = None

    # Try cookie first (browser sessions)
    token = request.cookies.get("access_token")

    # Fall back to Authorization header (API clients)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
        )

    # Decode token
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
        )

    # Fetch user from DB
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    return user


def require_role(required_role: str):
    """
    Factory that returns a dependency enforcing a specific role.
    
    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role("librarian"))])
        def admin_route(): ...
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}.",
            )
        return current_user
    return role_checker
