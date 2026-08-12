import os
import subprocess


def main():
    print("\n" + "=" * 55)
    print("      🌾 Kisan Vani - Interactive LLM Selector")
    print("=" * 55)
    print("Select LLM Provider:")
    print("  1) 🦙 Local Ollama (qwen2.5:3b) [Offline, Free, Ultra-Fast]")
    print("  2) ♊ Google Gemini (gemini-2.5-flash-lite)")
    print("  3) 🚀 Groq (llama-3.1-8b-instant)")
    print("=" * 55)

    try:
        choice = input("Choice [1/2/3] (default = 1): ").strip()
    except (EOFError, KeyboardInterrupt):
        choice = "1"

    if choice == "2":
        provider = "gemini"
        name = "Google Gemini (gemini-2.5-flash-lite)"
    elif choice == "3":
        provider = "groq"
        name = "Groq (llama-3.1-8b-instant)"
    else:
        provider = "ollama"
        name = "Local Ollama (qwen2.5:3b)"

    with open(".active_llm", "w", encoding="utf-8") as f:
        f.write(provider)

    print(f"\n✅ Selected LLM Provider: {name}")
    print("🚀 Starting Kisan Vani Agent Backend...\n")

    env = os.environ.copy()
    env["LLM_PROVIDER"] = provider
    subprocess.run(["uv", "run", "python", "src/agent.py", "dev"], env=env)


if __name__ == "__main__":
    main()
