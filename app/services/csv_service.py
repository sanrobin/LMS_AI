"""
CSV service for managing book locations (locations.csv).
Provides thread-safe CRUD operations over the flat file.

Schema: book_id, x_coord, y_coord, shelf_name
"""

import csv
import threading
from pathlib import Path
from typing import Optional

from app.config import LOCATIONS_CSV

# Thread lock for safe concurrent CSV writes on single-threaded Pi
_csv_lock = threading.Lock()


def _ensure_csv_exists():
    """Create the CSV file with headers if it doesn't exist."""
    if not LOCATIONS_CSV.exists():
        LOCATIONS_CSV.parent.mkdir(parents=True, exist_ok=True)
        with open(LOCATIONS_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["book_id", "x_coord", "y_coord", "shelf_name"])


def get_all_locations() -> list[dict]:
    """
    Read all book locations from CSV.
    
    Returns:
        List of dicts with keys: book_id, x_coord, y_coord, shelf_name
    """
    _ensure_csv_exists()
    with open(LOCATIONS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return [
            {
                "book_id": int(row["book_id"]),
                "x_coord": float(row["x_coord"]),
                "y_coord": float(row["y_coord"]),
                "shelf_name": row["shelf_name"].strip(),
            }
            for row in reader
        ]


def get_location(book_id: int) -> Optional[dict]:
    """
    Get location data for a specific book.
    
    Returns:
        Location dict or None if not found.
    """
    locations = get_all_locations()
    for loc in locations:
        if loc["book_id"] == book_id:
            return loc
    return None


def upsert_location(book_id: int, x_coord: float, y_coord: float, shelf_name: str) -> dict:
    """
    Add or update a book's location in the CSV.
    If book_id exists, updates the row. Otherwise, appends a new row.
    
    Thread-safe via file lock.
    """
    with _csv_lock:
        _ensure_csv_exists()
        locations = get_all_locations()

        # Update existing or append new
        updated = False
        for loc in locations:
            if loc["book_id"] == book_id:
                loc["x_coord"] = x_coord
                loc["y_coord"] = y_coord
                loc["shelf_name"] = shelf_name
                updated = True
                break

        if not updated:
            locations.append({
                "book_id": book_id,
                "x_coord": x_coord,
                "y_coord": y_coord,
                "shelf_name": shelf_name,
            })

        # Write entire file back
        _write_all(locations)

        return {"book_id": book_id, "x_coord": x_coord, "y_coord": y_coord, "shelf_name": shelf_name}


def delete_location(book_id: int) -> bool:
    """
    Remove a book's location entry from the CSV.
    
    Returns:
        True if the entry was found and removed, False otherwise.
    """
    with _csv_lock:
        _ensure_csv_exists()
        locations = get_all_locations()
        original_count = len(locations)
        locations = [loc for loc in locations if loc["book_id"] != book_id]

        if len(locations) == original_count:
            return False  # Nothing was deleted

        _write_all(locations)
        return True


def _write_all(locations: list[dict]):
    """Write the full location list back to CSV (internal helper)."""
    with open(LOCATIONS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["book_id", "x_coord", "y_coord", "shelf_name"])
        for loc in locations:
            writer.writerow([loc["book_id"], loc["x_coord"], loc["y_coord"], loc["shelf_name"]])
