"""
Location routes — manage book coordinates in locations.csv.
Librarians can update/delete; all users can read.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.models import User
from app.schemas import LocationUpdate, LocationResponse
from app.auth.dependencies import get_current_user, require_role
from app.services import csv_service

router = APIRouter(prefix="/api/locations", tags=["Locations"])


@router.get("", response_model=list[LocationResponse])
def list_locations(_current_user: User = Depends(get_current_user)):
    """Get all book location entries from CSV."""
    locations = csv_service.get_all_locations()
    return locations


@router.get("/{book_id}", response_model=LocationResponse)
def get_location(
    book_id: int,
    _current_user: User = Depends(get_current_user),
):
    """Get location data for a specific book."""
    location = csv_service.get_location(book_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found for this book.")
    return location


@router.put("/{book_id}", response_model=LocationResponse)
def upsert_location(
    book_id: int,
    data: LocationUpdate,
    _librarian: User = Depends(require_role("librarian")),
):
    """
    Add or update a book's map coordinates and shelf name (Librarian only).
    If the book already has a location, it will be overwritten.
    """
    result = csv_service.upsert_location(
        book_id=book_id,
        x_coord=data.x_coord,
        y_coord=data.y_coord,
        shelf_name=data.shelf_name,
    )
    return result


@router.delete("/{book_id}", status_code=204)
def delete_location(
    book_id: int,
    _librarian: User = Depends(require_role("librarian")),
):
    """Remove a book's location entry from CSV (Librarian only)."""
    deleted = csv_service.delete_location(book_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Location not found for this book.")
    return None
