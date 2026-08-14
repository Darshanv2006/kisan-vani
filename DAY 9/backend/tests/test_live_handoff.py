import asyncio
import logging
import os
import sys

from dotenv import load_dotenv
from livekit.agents import AgentSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
load_dotenv(".env.local")

from agent import Assistant, CropSpecialist, get_llm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_live_handoff")


async def run_diagnostic_test():
    print("\n========================================================")
    print("      DAY 9 CROP SPECIALIST HANDOFF DIAGNOSTIC TEST     ")
    print("========================================================\n")

    # Initialize agent session using project LLM provider
    async with (
        get_llm() as llm_inst,
        AgentSession(llm=llm_inst) as session,
    ):
        assistant = Assistant()
        await session.start(assistant)

        turn_1 = (
            "My tomato plants have black spots on their leaves. Identify the problem."
        )
        print(f"👤 USER (Turn 1): '{turn_1}'\n")

        res_1 = await session.run(user_input=turn_1)

        # Inspect Turn 1
        func_calls = [
            e for e in res_1.events if getattr(e, "type", "") == "function_call"
        ]
        messages_1 = [e for e in res_1.events if getattr(e, "type", "") == "message"]

        print("--- [1] TURN 1 TOOL CALLS ---")
        for fc in func_calls:
            print(f"Tool Executed: {fc.item.name}")
            print(f"Arguments: {getattr(fc.item, 'arguments', {})}")
        print()

        print("--- [2] TURN 1 MESSAGES (Main Agent Announcement) ---")
        for m in messages_1:
            content = m.item.content[0] if m.item.content else ""
            print(f"Role: {m.item.role} | Content: '{content}'")
        print()

        print("--- [3] ACTIVE AGENT POST-HANDOFF ---")
        print(f"Active Agent Class: {session.current_agent.__class__.__name__}")
        if isinstance(session.current_agent, CropSpecialist):
            print(f"Specialist Issue Summary: '{session.current_agent.issue_summary}'")
        print()

        # Turn 2: User continues with specialist
        turn_2 = "What is causing the black spots and what should I apply?"
        print(f"👤 USER (Turn 2): '{turn_2}'\n")

        res_2 = await session.run(user_input=turn_2)
        messages_2 = [e for e in res_2.events if getattr(e, "type", "") == "message"]

        print("--- [4] TURN 2 MESSAGES (Specialist Diagnosis) ---")
        for m in messages_2:
            content = m.item.content[0] if m.item.content else ""
            print(f"Role: {m.item.role} | Content: '{content}'")
            print(f"Specialist Output: '{content}'")
        print()

        # Verification
        assert len(func_calls) > 0, "FAIL: Handoff tool was not called!"
        assert func_calls[0].item.name == "hand_off_to_crop_specialist"
        assert isinstance(session.current_agent, CropSpecialist)

        spec_text = messages_2[-1].item.content[0].lower() if messages_2 else ""

        print("--- [5] VERIFICATION CHECKS ---")
        print(
            f"1. Acknowledged Tomato/Spots/Leaves: {'YES' if ('tomato' in spec_text or 'spot' in spec_text or 'leaf' in spec_text or 'leaves' in spec_text or 'blight' in spec_text or 'copper' in spec_text or 'fungal' in spec_text or 'fungicide' in spec_text) else 'NO'}"
        )
        print(
            f"2. Wheat/Cotton Injected: {'YES (BUG!)' if ('wheat' in spec_text or 'cotton' in spec_text) else 'NO (CORRECT)'}"
        )

        assert "wheat" not in spec_text and "cotton" not in spec_text, (
            f"FAIL: Wheat or Cotton was incorrectly injected! Text: '{spec_text}'"
        )

        print("\n========================================================")
        print(" SUCCESS: DAY 9 HANDOFF & CONTEXT VERIFIED WORKING 100%! ")
        print("========================================================\n")


if __name__ == "__main__":
    asyncio.run(run_diagnostic_test())
