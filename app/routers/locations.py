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


@router.get("/{genre}", response_model=LocationResponse)
def get_location(
    genre: str,
    _current_user: User = Depends(get_current_user),
):
    """Get location data for a specific genre."""
    location = csv_service.get_location(genre)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found for this genre.")
    return location


@router.put("/{genre}", response_model=LocationResponse)
def upsert_location(
    genre: str,
    data: LocationUpdate,
    _librarian: User = Depends(require_role("librarian")),
):
    """
    Add or update a genre's map coordinates and shelf name (Librarian only).
    If the genre already has a location, it will be overwritten.
    """
    result = csv_service.upsert_location(
        genre=genre,
        x_coord=data.x_coord,
        y_coord=data.y_coord,
        shelf_name=data.shelf_name,
    )
    return result


@router.delete("/{genre}", status_code=204)
def delete_location(
    genre: str,
    _librarian: User = Depends(require_role("librarian")),
):
    """Remove a genre's location entry from CSV (Librarian only)."""
    deleted = csv_service.delete_location(genre)
    if not deleted:
        raise HTTPException(status_code=404, detail="Location not found for this genre.")
    return None
