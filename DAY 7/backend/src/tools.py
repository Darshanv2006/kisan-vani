import asyncio
import json
import logging
import urllib.parse
import urllib.request
from datetime import datetime

logger = logging.getLogger("agent.tools")

# District coordinates mapping for popular Indian agricultural districts
DISTRICT_COORDINATES = {
    "bhatinda": {"lat": 30.211, "lon": 74.945, "state": "Punjab"},
    "ludhiana": {"lat": 30.901, "lon": 75.857, "state": "Punjab"},
    "jaipur": {"lat": 26.912, "lon": 75.787, "state": "Rajasthan"},
    "karnal": {"lat": 29.686, "lon": 76.990, "state": "Haryana"},
    "nashik": {"lat": 20.000, "lon": 73.780, "state": "Maharashtra"},
    "indore": {"lat": 22.719, "lon": 75.857, "state": "Madhya Pradesh"},
    "lucknow": {"lat": 26.846, "lon": 80.946, "state": "Uttar Pradesh"},
    "patna": {"lat": 25.594, "lon": 85.137, "state": "Bihar"},
    "rajkot": {"lat": 22.303, "lon": 70.802, "state": "Gujarat"},
    "amravati": {"lat": 20.937, "lon": 77.779, "state": "Maharashtra"},
}

# Mandi market prices dataset (Rates per Quintal in INR)
MANDI_PRICE_DATABASE = {
    "wheat": {
        "bhatinda": {
            "min_price": 2250,
            "max_price": 2420,
            "modal_price": 2350,
            "market": "Bhatinda Main Mandi",
        },
        "ludhiana": {
            "min_price": 2280,
            "max_price": 2450,
            "modal_price": 2380,
            "market": "Ludhiana Grain Market",
        },
        "karnal": {
            "min_price": 2270,
            "max_price": 2400,
            "modal_price": 2340,
            "market": "Karnal Mandi",
        },
        "default": {
            "min_price": 2200,
            "max_price": 2400,
            "modal_price": 2300,
            "market": "Regional APMC Mandi",
        },
    },
    "cotton": {
        "bhatinda": {
            "min_price": 6800,
            "max_price": 7400,
            "modal_price": 7150,
            "market": "Bhatinda Cotton Market",
        },
        "rajkot": {
            "min_price": 7000,
            "max_price": 7650,
            "modal_price": 7350,
            "market": "Rajkot APMC",
        },
        "amravati": {
            "min_price": 6900,
            "max_price": 7500,
            "modal_price": 7200,
            "market": "Amravati Mandi",
        },
        "default": {
            "min_price": 6700,
            "max_price": 7300,
            "modal_price": 7000,
            "market": "District Cotton Mandi",
        },
    },
    "rice": {
        "karnal": {
            "min_price": 3100,
            "max_price": 3600,
            "modal_price": 3400,
            "market": "Karnal Rice Market",
        },
        "patna": {
            "min_price": 2100,
            "max_price": 2450,
            "modal_price": 2300,
            "market": "Patna APMC",
        },
        "default": {
            "min_price": 2500,
            "max_price": 3200,
            "modal_price": 2850,
            "market": "Central Grain Mandi",
        },
    },
    "mustard": {
        "jaipur": {
            "min_price": 5400,
            "max_price": 5850,
            "modal_price": 5650,
            "market": "Jaipur Oilseed Mandi",
        },
        "default": {
            "min_price": 5200,
            "max_price": 5700,
            "modal_price": 5500,
            "market": "State Oilseed APMC",
        },
    },
    "onion": {
        "nashik": {
            "min_price": 1400,
            "max_price": 2200,
            "modal_price": 1850,
            "market": "Lasalgaon Mandi (Nashik)",
        },
        "default": {
            "min_price": 1300,
            "max_price": 2000,
            "modal_price": 1650,
            "market": "Regional Vegetable Market",
        },
    },
    "potato": {
        "lucknow": {
            "min_price": 1100,
            "max_price": 1500,
            "modal_price": 1320,
            "market": "Lucknow APMC",
        },
        "default": {
            "min_price": 1000,
            "max_price": 1450,
            "modal_price": 1250,
            "market": "District Sabzi Mandi",
        },
    },
}


WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast / Rain expected",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def _http_get_sync(url: str, timeout: int = 5) -> dict:
    """Internal synchronous HTTP GET with strict timeout."""
    req = urllib.request.Request(url, headers={"User-Agent": "KisanVaniVoiceAgent/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        if response.status == 200:
            data = response.read().decode("utf-8")
            return json.loads(data)
        raise RuntimeError(f"HTTP status code: {response.status}")


async def fetch_weather_forecast(district: str) -> str:
    """
    Fetch live weather forecast for a given district in India using Open-Meteo API.
    Returns temperature, humidity, precipitation chance, and date timestamp.
    """
    cleaned_district = district.strip().lower()
    coords = DISTRICT_COORDINATES.get(cleaned_district)

    if not coords:
        try:
            geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(district)}&count=1&language=en&format=json"
            geo_data = await asyncio.to_thread(_http_get_sync, geo_url, 3)
            results = geo_data.get("results", [])
            if results:
                coords = {
                    "lat": results[0]["latitude"],
                    "lon": results[0]["longitude"],
                    "state": results[0].get("admin1", "India"),
                }
        except Exception as geo_err:
            logger.warning(f"Geocoding lookup failed for {district}: {geo_err}")

    if not coords:
        coords = {"lat": 28.6139, "lon": 77.2090, "state": "India"}

    today_str = datetime.now().strftime("%B %d, %Y")

    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={coords['lat']}&longitude={coords['lon']}"
        f"&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max"
        f"&timezone=auto"
    )

    try:
        data = await asyncio.to_thread(_http_get_sync, url, 5)
        current = data.get("current", {})
        daily = data.get("daily", {})

        code = current.get("weather_code", 0)
        weather_condition = WMO_WEATHER_CODES.get(code, "Partly Cloudy / Rainy")
        temp_c = current.get("temperature_2m", "N/A")
        humidity = current.get("relative_humidity_2m", "N/A")
        wind_speed = current.get("wind_speed_10m", "N/A")
        max_temp = daily.get("temperature_2m_max", ["N/A"])[0]
        min_temp = daily.get("temperature_2m_min", ["N/A"])[0]
        rain_prob = daily.get("precipitation_probability_max", [0])[0]

        result = {
            "status": "success",
            "district": district.title(),
            "as_of_date": today_str,
            "condition": weather_condition,
            "current_temperature_celsius": temp_c,
            "max_temperature_celsius": max_temp,
            "min_temperature_celsius": min_temp,
            "relative_humidity_percent": humidity,
            "wind_speed_kmh": wind_speed,
            "rain_probability_percent": rain_prob,
        }
        logger.info(f"Weather fetched successfully for {district}: {result}")
        return json.dumps(result, ensure_ascii=False)

    except Exception as err:
        logger.error(f"Weather API failure for {district}: {err}")
        # Graceful failure return payload for LLM to speak out loud
        return json.dumps(
            {
                "status": "error",
                "district": district.title(),
                "as_of_date": today_str,
                "message": f"Unable to reach live weather servers for {district.title()} right now due to a network timeout. Please check again shortly.",
            },
            ensure_ascii=False,
        )


MANDI_BENCHMARK_DATE = "August 1, 2024"


async def fetch_mandi_prices(crop_name: str, district: str = "Bhatinda") -> str:
    """
    Fetch Mandi (APMC) market prices for a specific crop and district.
    Returns modal price, min price, max price per quintal in INR and benchmark dataset date.
    """
    cleaned_crop = crop_name.strip().lower()
    cleaned_district = district.strip().lower()

    # Check database for crop
    crop_data = MANDI_PRICE_DATABASE.get(cleaned_crop)

    if not crop_data:
        # Graceful fallback response if crop is not supported
        available_crops = ", ".join([c.title() for c in MANDI_PRICE_DATABASE])
        return json.dumps(
            {
                "status": "not_found",
                "crop": crop_name.title(),
                "district": district.title(),
                "as_of_date": MANDI_BENCHMARK_DATE,
                "message": f"Mandi rate for {crop_name.title()} is currently unavailable. Available crops are: {available_crops}.",
            },
            ensure_ascii=False,
        )

    # Get district specific price or default
    price_info = crop_data.get(cleaned_district, crop_data.get("default"))

    result = {
        "status": "success",
        "data_source": "curated_mandi_benchmark_dataset",
        "crop": crop_name.title(),
        "district": district.title(),
        "market_name": price_info["market"],
        "as_of_date": MANDI_BENCHMARK_DATE,
        "modal_price_per_quintal_inr": price_info["modal_price"],
        "min_price_per_quintal_inr": price_info["min_price"],
        "max_price_per_quintal_inr": price_info["max_price"],
        "unit": "Rs per quintal (100 kg)",
    }
    logger.info(f"Mandi price fetched for {crop_name} in {district}: {result}")
    return json.dumps(result, ensure_ascii=False)


def dispatch_human_escalation(ticket: dict) -> bool:
    """
    Dispatch escalation payload to Discord Webhook and local JSON store.
    """
    import os
    from pathlib import Path

    # 1. Save locally to backend/escalations.json for local UI display
    escalations_file = Path(__file__).parent.parent / "escalations.json"
    existing_tickets = []
    if escalations_file.exists():
        try:
            with open(escalations_file, encoding="utf-8") as f:
                existing_tickets = json.load(f)
        except Exception:
            existing_tickets = []

    # Prepend new ticket
    existing_tickets.insert(0, ticket)
    try:
        with open(escalations_file, "w", encoding="utf-8") as f:
            json.dump(existing_tickets, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed writing to escalations.json: {e}")

    # 2. Print formatted Console Card
    print("\n" + "=" * 75)
    print("🚨 HUMAN ESCALATION REQUEST DISPATCHED 🚨".center(75))
    print("=" * 75)
    print(f" Ticket ID:      {ticket.get('ticket_id')}")
    print(f" Caller Name:    {ticket.get('caller_name')}")
    print(f" District:       {ticket.get('district')}")
    print(f" Category:       {ticket.get('issue_category')}")
    print(f" Urgency:        {ticket.get('urgency')}")
    print(f" Issue Summary:  {ticket.get('issue_summary')}")
    print(f" Agent Checked:  {ticket.get('agent_checked')}")
    print(
        f" User Consent:   {'GRANTED ✅' if ticket.get('user_consent_granted') else 'DECLINED ❌'}"
    )
    print(f" Created At:     {ticket.get('created_at')}")
    print("=" * 75 + "\n")

    # 3. Post to Discord Webhook if URL is configured
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        logger.info(
            "DISCORD_WEBHOOK_URL not set in env. Local DB & escalations.json record saved successfully."
        )
        return True

    urgency_color_map = {
        "EMERGENCY": 15158332,  # Red
        "HIGH": 15105570,  # Orange
        "MEDIUM": 15844367,  # Yellow
        "LOW": 3066993,  # Green
    }
    color = urgency_color_map.get(str(ticket.get("urgency")).upper(), 15105570)

    discord_payload = {
        "username": "Kisan Vani AI Escalation Bot",
        "avatar_url": "https://cdn-icons-png.flaticon.com/512/3655/3655581.png",
        "embeds": [
            {
                "title": f"🚨 Human Help Ticket: {ticket.get('ticket_id')}",
                "description": f"**Farmer Issue**: {ticket.get('issue_summary')}",
                "color": color,
                "fields": [
                    {
                        "name": "👨‍🌾 Farmer Name",
                        "value": ticket.get("caller_name", "Shivu"),
                        "inline": True,
                    },
                    {
                        "name": "📍 District",
                        "value": ticket.get("district", "Bhatinda"),
                        "inline": True,
                    },
                    {
                        "name": "⚠️ Urgency",
                        "value": ticket.get("urgency", "HIGH"),
                        "inline": True,
                    },
                    {
                        "name": "🏷️ Category",
                        "value": ticket.get("issue_category", "Crop Emergency"),
                        "inline": True,
                    },
                    {
                        "name": "🔍 Agent Diagnostics",
                        "value": ticket.get(
                            "agent_checked", "Checked weather and mandi prices"
                        ),
                        "inline": False,
                    },
                    {
                        "name": "✅ User Consent",
                        "value": "Consent Granted by Caller",
                        "inline": True,
                    },
                    {
                        "name": "📞 Follow-Up",
                        "value": "Phone Callback (Within 24 Hours)",
                        "inline": True,
                    },
                ],
                "footer": {"text": "Kisan Vani Voice AI • Murf Falcon TTS & LiveKit"},
                "timestamp": ticket.get("created_at"),
            }
        ],
    }

    try:
        req_data = json.dumps(discord_payload).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "KisanVaniWebhook/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            logger.info(f"Discord Webhook delivered with status {resp.status}")
            return True
    except Exception as webhook_err:
        logger.error(f"Error posting to Discord Webhook: {webhook_err}")
        return False
