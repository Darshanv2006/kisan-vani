import os
import sys
import pytest
from livekit.agents import AgentSession, inference, llm

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from agent import Assistant, CropSpecialist


def _llm() -> llm.LLM:
    return inference.LLM(model="openai/gpt-4.1-mini")


@pytest.mark.asyncio
async def test_tomato_black_spots_handoff_context() -> None:
    """
    Test Day 9 Crop Specialist Context Handoff:
    User asks: 'My tomato plants have black spots on their leaves. Identify the problem.'
    Expected:
    1. Main agent triggers hand_off_to_crop_specialist with issue_summary.
    2. Session updates to CropSpecialist.
    3. CropSpecialist understands tomato/black-spots/leaves issue on follow-up turn.
    4. Response does NOT inject unrelated wheat or cotton context.
    """
    async with (
        _llm() as llm_inst,
        AgentSession(llm=llm_inst) as session,
    ):
        assistant = Assistant()
        await session.start(assistant)

        res_1 = await session.run(
            user_input="My tomato plants have black spots on their leaves. Identify the problem."
        )

        # 1. Check hand_off_to_crop_specialist tool call
        func_calls = [
            e for e in res_1.events if getattr(e, "type", "") == "function_call"
        ]
        assert len(func_calls) > 0, "ERROR: Handoff tool was not called!"
        assert func_calls[0].item.name == "hand_off_to_crop_specialist", (
            f"ERROR: Wrong tool called: {func_calls[0].item.name}"
        )

        # 2. Check active agent transferred to CropSpecialist
        assert isinstance(session.current_agent, CropSpecialist), (
            "ERROR: Agent failed to transfer to CropSpecialist!"
        )
        assert session.current_agent.issue_summary != "", (
            "ERROR: issue_summary was not passed to CropSpecialist!"
        )

        # 3. Turn 2: Specialist diagnosis turn
        res_2 = await session.run(
            user_input="What is causing the black spots and what should I apply?"
        )
        messages_2 = [e for e in res_2.events if getattr(e, "type", "") == "message"]
        assert len(messages_2) > 0, "ERROR: No response message from specialist!"

        specialist_text = messages_2[-1].item.content[0].lower()
        print(f"\nSpecialist Response: '{specialist_text}'")

        # Verify crop problem context is present
        assert (
            "tomato" in specialist_text
            or "spot" in specialist_text
            or "leaf" in specialist_text
            or "leaves" in specialist_text
            or "blight" in specialist_text
            or "copper" in specialist_text
            or "fungal" in specialist_text
            or "fungicide" in specialist_text
        ), (
            f"ERROR: Specialist did not acknowledge tomato/black-spots issue! Response: {specialist_text}"
        )

        # Verify wheat / cotton are NOT injected into tomato response
        assert "wheat" not in specialist_text and "cotton" not in specialist_text, (
            f"ERROR: Unrelated wheat/cotton context was incorrectly injected! Response: {specialist_text}"
        )

        print("✅ PASS: Tomato black spots handoff context test succeeded cleanly!")
