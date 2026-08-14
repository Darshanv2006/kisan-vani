import asyncio
import os
import sys
import time
import logging

from dotenv import load_dotenv
from livekit.agents import AgentSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
load_dotenv(".env.local")

from agent import Assistant, CropSpecialist, get_llm

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("benchmark_pipeline")


async def run_benchmark():
    print("\n========================================================")
    print("      KISAN VANI PIPELINE LATENCY BENCHMARK SUITE       ")
    print("========================================================\n")

    timing_results = {}

    async with (
        get_llm() as llm_inst,
        AgentSession(llm=llm_inst) as session,
    ):
        assistant = Assistant()
        await session.start(assistant)

        # ----------------------------------------------------
        # TEST 1: Normal Advisory Question
        # "How often should I irrigate my wheat crop?"
        # ----------------------------------------------------
        print("--- [TEST 1: Normal General Advisory Query] ---")
        prompt_1 = "How often should I irrigate my wheat crop?"
        print(f"👤 User: '{prompt_1}'")

        t0_start = time.perf_counter()

        # Run turn 1
        res_1 = await session.run(user_input=prompt_1)

        t1_llm_done = time.perf_counter()

        events_1 = res_1.events
        func_calls_1 = [
            e for e in events_1 if getattr(e, "type", "") == "function_call"
        ]
        messages_1 = [e for e in events_1 if getattr(e, "type", "") == "message"]

        content_1 = messages_1[-1].item.content[0] if messages_1 else ""

        llm_duration_1 = round(t1_llm_done - t0_start, 3)
        print(f"⏱️ LLM & Direct Routing Time: {llm_duration_1}s")
        print(
            f"🛠️ Tools Called: {len(func_calls_1)} ({[fc.item.name for fc in func_calls_1]})"
        )
        print(f"🤖 Kisan Vani Response: '{content_1}'\n")

        timing_results["test_1"] = {
            "llm_time_sec": llm_duration_1,
            "tool_calls_count": len(func_calls_1),
            "response": content_1,
        }

        # ----------------------------------------------------
        # TEST 2: Crop Specialist Handoff Question
        # "My tomato plants have black spots on their leaves. What should I do?"
        # ----------------------------------------------------
        print("--- [TEST 2: Crop Specialist Disease Handoff Query] ---")
        prompt_2_a = (
            "My tomato plants have black spots on their leaves. What should I do?"
        )
        print(f"👤 User (Turn 1): '{prompt_2_a}'")

        t0_handoff_start = time.perf_counter()
        res_2_a = await session.run(user_input=prompt_2_a)
        t1_handoff_done = time.perf_counter()

        events_2_a = res_2_a.events
        func_calls_2_a = [
            e for e in events_2_a if getattr(e, "type", "") == "function_call"
        ]
        messages_2_a = [e for e in events_2_a if getattr(e, "type", "") == "message"]
        announcement = messages_2_a[-1].item.content[0] if messages_2_a else ""

        handoff_duration = round(t1_handoff_done - t0_handoff_start, 3)
        print(f"⏱️ Handoff Execution & Announcement Time: {handoff_duration}s")
        print(f"🛠️ Handoff Tool Called: {[fc.item.name for fc in func_calls_2_a]}")
        print(f"📢 Main Agent Announcement: '{announcement}'")
        print(
            f"🔄 Active Agent Post-Handoff: {session.current_agent.__class__.__name__}\n"
        )

        # Specialist Turn
        prompt_2_b = "Identify the cause and tell me what fungicide to apply."
        print(f"👤 User (Turn 2 - Specialist): '{prompt_2_b}'")

        t0_spec_start = time.perf_counter()
        res_2_b = await session.run(user_input=prompt_2_b)
        t1_spec_done = time.perf_counter()

        events_2_b = res_2_b.events
        messages_2_b = [e for e in events_2_b if getattr(e, "type", "") == "message"]
        spec_response = messages_2_b[-1].item.content[0] if messages_2_b else ""

        spec_duration = round(t1_spec_done - t0_spec_start, 3)
        print(f"⏱️ Specialist Diagnosis Response Time: {spec_duration}s")
        print(f"🌿 Crop Specialist Response: '{spec_response}'\n")

        timing_results["test_2"] = {
            "handoff_time_sec": handoff_duration,
            "specialist_response_time_sec": spec_duration,
            "announcement": announcement,
            "specialist_response": spec_response,
        }

    print("========================================================")
    print("                BENCHMARK SUMMARY REPORT                ")
    print("========================================================")
    print(
        f"Test 1 (General Irrigation)  -> LLM Latency: {timing_results['test_1']['llm_time_sec']}s | Tools Called: {timing_results['test_1']['tool_calls_count']}"
    )
    print(
        f"Test 2 (Tomato Specialist)   -> Handoff Latency: {timing_results['test_2']['handoff_time_sec']}s | Diagnosis Latency: {timing_results['test_2']['specialist_response_time_sec']}s"
    )
    print("========================================================\n")


if __name__ == "__main__":
    asyncio.run(run_benchmark())
