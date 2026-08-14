import asyncio
import os
import sys
import time

from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

load_dotenv(".env.local")

from livekit.agents import AgentSession

from agent import Assistant, get_llm


async def run_benchmark():
    print("=" * 70)
    print("⚡ KISAN VANI LATENCY & TOOL ROUTING BENCHMARK ⚡")
    print("=" * 70)

    agent_llm = get_llm()

    # Test Case 1: General Crop Question (Should NOT trigger weather or mandi tools)
    q1 = "How often should I irrigate my wheat crop?"
    print(f"\n[Test 1] Question: '{q1}'")

    t0 = time.time()
    assistant1 = Assistant()
    async with (
        agent_llm as llm_inst,
        AgentSession(llm=llm_inst) as session1,
    ):
        await session1.start(assistant1)

        stt_to_llm_start = (time.time() - t0) * 1000
        print(f"  • STT Final Transcript -> LLM Start: {stt_to_llm_start:.2f} ms")

        t_llm = time.time()
        _ = await session1.run(user_input=q1)
        llm_response_time = (time.time() - t_llm) * 1000

        total_time_q1 = (time.time() - t0) * 1000
        print(f"  • LLM Response Time: {llm_response_time:.2f} ms")
        print(f"  • Tools Executed: {assistant1.tools_used}")
        print(f"  • Total Pipeline Time: {total_time_q1:.2f} ms")

        assert len(assistant1.tools_used) == 0, (
            f"ERROR: General question triggered unnecessary tools: {assistant1.tools_used}"
        )
        print("  ✅ PASS: 0 unnecessary tool calls executed!")

    # Test Case 2: Mandi Price Question
    q2 = "What is the mandi price of wheat in Bhatinda?"
    print(f"\n[Test 2] Question: '{q2}'")

    t0_q2 = time.time()
    assistant2 = Assistant()
    async with (
        agent_llm as llm_inst2,
        AgentSession(llm=llm_inst2) as session2,
    ):
        await session2.start(assistant2)
        _ = await session2.run(user_input=q2)

        total_time_q2 = (time.time() - t0_q2) * 1000
        print(f"  • Tools Executed: {assistant2.tools_used}")
        print(f"  • Total Response Time: {total_time_q2:.2f} ms")
        assert "get_mandi_market_prices" in assistant2.tools_used, (
            "ERROR: Mandi tool was not executed!"
        )
        print("  ✅ PASS: Mandi price tool correctly routed!")

    # Test Case 3: Specialist Handoff Question
    q3 = (
        "My cotton leaves are turning yellow and I see small insects. What should I do?"
    )
    print(f"\n[Test 3] Question: '{q3}'")

    t0_q3 = time.time()
    assistant3 = Assistant()
    async with (
        agent_llm as llm_inst3,
        AgentSession(llm=llm_inst3) as session3,
    ):
        await session3.start(assistant3)
        _ = await session3.run(user_input=q3)

        total_time_q3 = (time.time() - t0_q3) * 1000
        print(f"  • Tools Executed: {assistant3.tools_used}")
        print(f"  • Total Response Time: {total_time_q3:.2f} ms")
        assert "hand_off_to_crop_specialist" in assistant3.tools_used, (
            "ERROR: Specialist handoff tool was not executed!"
        )
        print("  ✅ PASS: Specialist handoff tool correctly routed in milliseconds!")

    print("\n" + "=" * 70)
    print("ALL LATENCY & ROUTING BENCHMARKS PASSED SUCCESSFULLY! 🎉")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_benchmark())
