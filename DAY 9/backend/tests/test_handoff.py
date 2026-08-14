import os
import sys

import pytest
from livekit.agents import AgentSession, inference, llm

# Ensure backend/src is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from agent import Assistant, CropSpecialist


def _llm() -> llm.LLM:
    return inference.LLM(model="openai/gpt-4.1-mini")


@pytest.mark.asyncio
async def test_1_main_agent_handles_mandi_price_directly() -> None:
    """
    Test 1 — Main Agent Path:
    User asks: 'What is the mandi price of wheat in Bhatinda?'
    Expected:
    - Main Kisan Vani agent handles the question using get_mandi_market_prices.
    - NO specialist handoff occurs.
    - Main agent responds normally with market price info.
    """
    async with (
        _llm() as llm_inst,
        AgentSession(llm=llm_inst) as session,
    ):
        assistant = Assistant()
        await session.start(assistant)

        result = await session.run(
            user_input="What is the mandi price of wheat in Bhatinda?"
        )

        # 1. Check that get_mandi_market_prices tool was called by main agent
        func_calls = [
            e for e in result.events if getattr(e, "type", "") == "function_call"
        ]
        assert len(func_calls) > 0
        assert func_calls[0].item.name == "get_mandi_market_prices"

        # 2. Check that active agent remains Assistant (No handoff)
        assert session.current_agent == assistant


@pytest.mark.asyncio
async def test_2_crop_specialist_handoff_and_treatment() -> None:
    """
    Test 2 — Crop Specialist Handoff Path:
    User asks: 'My cotton leaves are turning yellow and I see small insects. What should I do?'
    Expected:
    1. Main agent recognizes crop-health problem.
    2. Main agent says: "I'll connect you with our crop problem specialist."
    3. Main agent calls hand_off_to_crop_specialist tool.
    4. Conversation transitions to CropSpecialist agent.
    5. Specialist introduces itself and provides treatment advice without asking farmer to repeat.
    """
    async with (
        _llm() as llm_inst,
        AgentSession(llm=llm_inst) as session,
    ):
        assistant = Assistant()
        await session.start(assistant)

        # User asks about cotton leaves turning yellow with small insects
        result = await session.run(
            user_input="My cotton leaves are turning yellow and I see small insects. What should I do?"
        )

        # 1. Check verbal announcement: Main agent says "I'll connect you with our crop problem specialist."
        messages = [e for e in result.events if getattr(e, "type", "") == "message"]
        assert len(messages) > 0
        announcement = messages[0].item.content[0].lower()
        assert "connect" in announcement or "specialist" in announcement

        # 2. Check function call: hand_off_to_crop_specialist tool executed
        func_calls = [
            e for e in result.events if getattr(e, "type", "") == "function_call"
        ]
        assert len(func_calls) > 0
        assert func_calls[0].item.name == "hand_off_to_crop_specialist"

        # 3. Check active agent transferred to CropSpecialist instance
        assert isinstance(session.current_agent, CropSpecialist)
