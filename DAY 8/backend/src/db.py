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
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS escalations (
            ticket_id TEXT PRIMARY KEY,
            user_id TEXT,
            caller_name TEXT,
            contact_number TEXT,
            district TEXT,
            issue_category TEXT,
            urgency TEXT,
            issue_summary TEXT,
            agent_checked TEXT,
            user_consent_granted INTEGER,
            status TEXT DEFAULT 'OPEN',
            created_at TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS call_analytics (
            call_id TEXT PRIMARY KEY,
            user_id TEXT,
            channel TEXT DEFAULT 'Browser',
            start_time TEXT,
            end_time TEXT,
            duration_seconds INTEGER DEFAULT 0,
            status TEXT DEFAULT 'SUCCESS',
            failure_reason TEXT DEFAULT 'None',
            query_type TEXT DEFAULT 'General Advisory',
            language TEXT DEFAULT 'English',
            tools_used TEXT DEFAULT '[]',
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")


def get_farmer_profile(user_id: str = "farmer_1"):
    """Fetch farmer profile by user_id or fallback to latest saved profile."""
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
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM farmers WHERE user_id = ?", (user_id,))
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted_count > 0


def create_escalation_ticket(
    ticket_id: str,
    user_id: str = "farmer_1",
    caller_name: str = "Shivu",
    contact_number: str = "+91 98765 43210",
    district: str = "Bhatinda",
    issue_category: str = "Crop Disease Emergency",
    urgency: str = "high",
    issue_summary: str = "",
    agent_checked: str = "",
    user_consent_granted: bool = True,
) -> dict:
    """Save a new human escalation ticket to SQLite DB."""
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """
        INSERT OR REPLACE INTO escalations (
            ticket_id, user_id, caller_name, contact_number, district,
            issue_category, urgency, issue_summary, agent_checked,
            user_consent_granted, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
        """,
        (
            ticket_id,
            user_id,
            caller_name,
            contact_number,
            district,
            issue_category,
            urgency.upper(),
            issue_summary,
            agent_checked,
            1 if user_consent_granted else 0,
            created_at,
        ),
    )
    conn.commit()
    conn.close()
    logger.info(f"Escalation ticket {ticket_id} created in database.")
    return {
        "ticket_id": ticket_id,
        "user_id": user_id,
        "caller_name": caller_name,
        "contact_number": contact_number,
        "district": district,
        "issue_category": issue_category,
        "urgency": urgency.upper(),
        "issue_summary": issue_summary,
        "agent_checked": agent_checked,
        "user_consent_granted": user_consent_granted,
        "status": "OPEN",
        "created_at": created_at,
    }


def get_escalation_tickets(user_id: Optional[str] = None):
    """Retrieve all escalation tickets from SQLite DB."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute(
            "SELECT * FROM escalations WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        )
    else:
        cursor.execute("SELECT * FROM escalations ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def export_analytics_json():
    """Export current analytics summary to backend/analytics.json for Next.js API route."""
    try:
        data = get_call_analytics()
        json_path = Path(__file__).parent.parent / "analytics.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Error exporting analytics.json: {e}")


def log_call_analytics(
    call_id: str,
    user_id: str = "farmer_1",
    channel: str = "Browser",
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    duration_seconds: int = 0,
    status: str = "SUCCESS",
    failure_reason: str = "None",
    query_type: str = "General Advisory",
    language: str = "English",
    tools_used: Optional[list] = None,
) -> dict:
    """Save call outcome into call_analytics table and sync JSON cache."""
    conn = get_db_connection()
    cursor = conn.cursor()

    now_str = datetime.now(timezone.utc).isoformat()
    start_str = start_time if start_time else now_str
    end_str = end_time if end_time else now_str
    tools_json = json.dumps(tools_used or [])

    cursor.execute(
        """
        INSERT OR REPLACE INTO call_analytics (
            call_id, user_id, channel, start_time, end_time, duration_seconds,
            status, failure_reason, query_type, language, tools_used, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            call_id,
            user_id,
            channel,
            start_str,
            end_str,
            duration_seconds,
            status.upper(),
            failure_reason,
            query_type,
            language,
            tools_json,
            now_str,
        ),
    )
    conn.commit()
    conn.close()

    export_analytics_json()
    logger.info(f"Logged call {call_id}: status={status}, duration={duration_seconds}s")
    return {
        "call_id": call_id,
        "status": status.upper(),
        "duration_seconds": duration_seconds,
        "query_type": query_type,
    }


def get_call_analytics():
    """Retrieve full call analytics metrics, failure categories, and recent history."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as total FROM call_analytics")
    total_calls = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM call_analytics WHERE status = 'SUCCESS'")
    successful_calls = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM call_analytics WHERE status = 'FAILED'")
    failed_calls = cursor.fetchone()["total"]

    success_rate = (
        round((successful_calls / total_calls) * 100, 1) if total_calls > 0 else 0.0
    )

    # Failure breakdown
    cursor.execute(
        "SELECT failure_reason, COUNT(*) as count FROM call_analytics WHERE status = 'FAILED' GROUP BY failure_reason"
    )
    failure_rows = cursor.fetchall()
    failure_breakdown = {row["failure_reason"]: row["count"] for row in failure_rows}

    # Query type breakdown
    cursor.execute(
        "SELECT query_type, COUNT(*) as count FROM call_analytics GROUP BY query_type"
    )
    query_rows = cursor.fetchall()
    query_breakdown = {row["query_type"]: row["count"] for row in query_rows}

    # Recent 20 calls
    cursor.execute(
        "SELECT * FROM call_analytics ORDER BY created_at DESC LIMIT 20"
    )
    history_rows = cursor.fetchall()
    call_history = [dict(row) for row in history_rows]

    conn.close()

    return {
        "total_calls": total_calls,
        "successful_calls": successful_calls,
        "failed_calls": failed_calls,
        "success_rate": success_rate,
        "failure_breakdown": failure_breakdown,
        "query_breakdown": query_breakdown,
        "recent_calls": call_history,
    }


# Automatically initialize DB schema once on module load
try:
    init_db()
except Exception as _e:
    logger.warning(f"Initial DB schema check notice: {_e}")


