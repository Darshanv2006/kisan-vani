import json

import pytest

from src.tools import fetch_mandi_prices, fetch_weather_forecast


@pytest.mark.asyncio
async def test_fetch_weather_forecast_success():
    result_str = await fetch_weather_forecast("Bhatinda")
    data = json.loads(result_str)

    assert data["status"] == "success"
    assert data["district"] == "Bhatinda"
    assert "as_of_date" in data
    assert "current_temperature_celsius" in data
    assert "rain_probability_percent" in data


@pytest.mark.asyncio
async def test_fetch_weather_forecast_fallback():
    # Call with non-cached district to ensure Open-Meteo fallback coordinates work
    result_str = await fetch_weather_forecast("Chandigarh")
    data = json.loads(result_str)

    assert data["status"] == "success"
    assert data["district"] == "Chandigarh"
    assert "as_of_date" in data


@pytest.mark.asyncio
async def test_fetch_mandi_prices_success():
    result_str = await fetch_mandi_prices("Cotton", "Bhatinda")
    data = json.loads(result_str)

    assert data["status"] == "success"
    assert data["crop"] == "Cotton"
    assert data["district"] == "Bhatinda"
    assert data["modal_price_per_quintal_inr"] == 7150
    assert "as_of_date" in data
    assert "market_name" in data


@pytest.mark.asyncio
async def test_fetch_mandi_prices_unknown_crop():
    result_str = await fetch_mandi_prices("Saffron", "Bhatinda")
    data = json.loads(result_str)

    assert data["status"] == "not_found"
    assert data["crop"] == "Saffron"
    assert "message" in data
    assert "as_of_date" in data
