import json
from pathlib import Path

try:
    from db import create_escalation_ticket, get_escalation_tickets
    from tools import dispatch_human_escalation
except ImportError:
    from src.db import create_escalation_ticket, get_escalation_tickets
    from src.tools import dispatch_human_escalation


def test_create_escalation_db_record():
    """Verify that an escalation ticket is correctly stored in SQLite DB."""
    ticket_id = "KV-TEST-999"
    result = create_escalation_ticket(
        ticket_id=ticket_id,
        user_id="farmer_1",
        caller_name="Shivu",
        contact_number="+91 98765 43210",
        district="Bhatinda",
        issue_category="Crop Disease Emergency",
        urgency="HIGH",
        issue_summary="Severe pink bollworm infestation reported on cotton crop.",
        agent_checked="Checked weather and mandi prices; pest infestation requires human agricultural officer.",
        user_consent_granted=True,
    )

    assert result["ticket_id"] == ticket_id
    assert result["urgency"] == "HIGH"
    assert result["user_consent_granted"] is True
    assert result["status"] == "OPEN"

    # Verify retrieval from DB
    tickets = get_escalation_tickets("farmer_1")
    assert any(t["ticket_id"] == ticket_id for t in tickets)


def test_escalation_dispatched_locally():
    """Verify dispatch_human_escalation saves ticket to local JSON file."""
    ticket = {
        "ticket_id": "KV-DISPATCH-001",
        "caller_name": "Test Farmer",
        "district": "Bhatinda",
        "issue_category": "Crop Disease Emergency",
        "urgency": "EMERGENCY",
        "issue_summary": "Test pink bollworm outbreak",
        "agent_checked": "Checked weather forecast; confirmed pest emergency",
        "user_consent_granted": True,
        "created_at": "2026-08-12T10:00:00Z",
    }

    status = dispatch_human_escalation(ticket)
    assert status is True

    # Read escalations.json
    backend_dir = Path(__file__).parent.parent
    escalations_file = backend_dir / "escalations.json"
    assert escalations_file.exists()

    with open(escalations_file, encoding="utf-8") as f:
        data = json.load(f)
        assert any(t.get("ticket_id") == "KV-DISPATCH-001" for t in data)
