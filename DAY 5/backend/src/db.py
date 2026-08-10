import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger("agent.db")

# Path for SQLite database file
DB_PATH = Path(__file__).parent.parent / "kisan_vani.db"


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database schema if it doesn't exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS farmers (
            user_id TEXT PRIMARY KEY,
            name TEXT,
            language_preference TEXT DEFAULT 'en',
            crops_grown TEXT,
            land_size TEXT,
            district TEXT,
            irrigation_type TEXT,
            facts_json TEXT,
            last_interaction TEXT
        )
    """)
    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")


def get_farmer_profile(user_id: str = "farmer_1"):
    """Fetch farmer profile by user_id or fallback to latest saved profile."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM farmers WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    if not row and user_id == "farmer_1":
        cursor.execute("SELECT * FROM farmers ORDER BY last_interaction DESC LIMIT 1")
        row = cursor.fetchone()
    conn.close()

    if row:
        profile = dict(row)
        if profile.get("facts_json"):
            try:
                profile["facts"] = json.loads(profile["facts_json"])
            except Exception:
                profile["facts"] = {}
        else:
            profile["facts"] = {}
        return profile


def save_farmer_profile(
    user_id: str = "farmer_1",
    name: Optional[str] = None,
    language_preference: Optional[str] = None,
    crops_grown: Optional[str] = None,
    land_size: Optional[str] = None,
    district: Optional[str] = None,
    irrigation_type: Optional[str] = None,
    facts: Optional[dict] = None,
):
    """Save or update farmer profile in SQLite database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    existing = get_farmer_profile(user_id) or {}

    final_name = name if name is not None else existing.get("name")
    final_lang = (
        language_preference
        if language_preference is not None
        else existing.get("language_preference", "en")
    )
    final_crops = (
        crops_grown if crops_grown is not None else existing.get("crops_grown")
    )
    final_land = land_size if land_size is not None else existing.get("land_size")
    final_district = district if district is not None else existing.get("district")
    final_irrigation = (
        irrigation_type
        if irrigation_type is not None
        else existing.get("irrigation_type")
    )

    existing_facts = existing.get("facts", {})
    if facts:
        existing_facts.update(facts)

    now_str = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """
        INSERT INTO farmers (
            user_id, name, language_preference, crops_grown, land_size, district, irrigation_type, facts_json, last_interaction
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            name=excluded.name,
            language_preference=excluded.language_preference,
            crops_grown=excluded.crops_grown,
            land_size=excluded.land_size,
            district=excluded.district,
            irrigation_type=excluded.irrigation_type,
            facts_json=excluded.facts_json,
            last_interaction=excluded.last_interaction
    """,
        (
            user_id,
            final_name,
            final_lang,
            final_crops,
            final_land,
            final_district,
            final_irrigation,
            json.dumps(existing_facts),
            now_str,
        ),
    )

    conn.commit()
    conn.close()
    logger.info(
        f"Saved profile for farmer {user_id}: name={final_name}, crops={final_crops}"
    )
    return {
        "user_id": user_id,
        "name": final_name,
        "language_preference": final_lang,
        "crops_grown": final_crops,
        "land_size": final_land,
        "district": final_district,
        "irrigation_type": final_irrigation,
        "facts": existing_facts,
        "last_interaction": now_str,
    }


def forget_farmer_profile(user_id: str = "farmer_1"):
    """Delete a farmer profile from the database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM farmers WHERE user_id = ?", (user_id,))
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted_count > 0
