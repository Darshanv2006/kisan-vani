from src.db import (
    forget_farmer_profile,
    get_farmer_profile,
    init_db,
    save_farmer_profile,
)


def test_sqlite_memory_lifecycle():
    init_db()

    # 1. Ensure clean state for test user
    forget_farmer_profile("test_user_99")

    # 2. Check lookup on non-existent caller
    profile = get_farmer_profile("test_user_99")
    assert profile is None

    # 3. Save farmer profile
    saved = save_farmer_profile(
        user_id="test_user_99",
        name="Ramesh Kumar",
        language_preference="hi",
        crops_grown="Cotton & Wheat",
        land_size="4 acres",
        district="Bhatinda",
        irrigation_type="Drip",
        facts={"notes": "Sprayed pesticide last week"},
    )
    assert saved["name"] == "Ramesh Kumar"
    assert saved["crops_grown"] == "Cotton & Wheat"

    # 4. Lookup existing farmer profile
    retrieved = get_farmer_profile("test_user_99")
    assert retrieved is not None
    assert retrieved["name"] == "Ramesh Kumar"
    assert retrieved["crops_grown"] == "Cotton & Wheat"
    assert retrieved["district"] == "Bhatinda"

    # 5. Test Forget Me
    deleted = forget_farmer_profile("test_user_99")
    assert deleted is True

    # Verify post-delete lookup
    profile_after = get_farmer_profile("test_user_99")
    assert profile_after is None
