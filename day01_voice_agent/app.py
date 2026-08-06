import streamlit as st
import streamlit.components.v1 as components
import os
import base64
from dotenv import load_dotenv
from murf_falcon import MurfFalconEngine, INDIAN_VOICES
from llm_engine import AgriLLMEngine

load_dotenv()

st.set_page_config(
    page_title="Kisan Vani — AI Voice Companion for Farmers",
    page_icon="🌾",
    layout="wide",
    initial_sidebar_state="collapsed",
)

def load_b64(filename):
    path = os.path.join(os.path.dirname(__file__), filename)
    if os.path.exists(path):
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return ""

farmer_b64 = load_b64("kisan_vani_banner.png")
sunrise_bg_b64 = load_b64("hero_sunrise_bg.jpg")

effective_api_key = os.getenv("MURF_API_KEY", "").strip()
if effective_api_key in ["your_murf_api_key_here", "YOUR_API_KEY"]:
    effective_api_key = ""

# ══════════════════════════════════════════════════════════════════════
# STREAMLIT GLOBAL THEME & HIDE SIDEBAR
# ══════════════════════════════════════════════════════════════════════
st.markdown("""<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
}
#MainMenu, header, footer, .stDeployButton, section[data-testid="stSidebar"], button[data-testid="baseButton-header"] {
    display: none !important;
    visibility: hidden !important;
}
.block-container {
    padding: 0rem !important;
    max-width: 100% !important;
}
.stApp {
    background-color: #040D07 !important;
}
iframe[data-testid="stIFrame"] {
    margin-bottom: -15px !important;
}
div[data-testid="stVerticalBlock"] {
    gap: 0.5rem !important;
}
div.stButton > button {
    background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%) !important;
    color: #FFFFFF !important;
    border: none !important;
    border-radius: 12px !important;
    font-weight: 700 !important;
    padding: 0.6rem 1.5rem !important;
    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3) !important;
    transition: all 0.3s ease !important;
}
div.stButton > button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(34, 197, 94, 0.5) !important;
}
div[data-testid="stTextArea"] textarea {
    background: rgba(10, 25, 16, 0.9) !important;
    color: #F8FAFC !important;
    border: 1px solid rgba(34, 197, 94, 0.3) !important;
    border-radius: 16px !important;
    font-size: 15px !important;
}
</style>""", unsafe_allow_html=True)

selected_voice = "Anisha (Indian English - Female)"
is_connected = bool(effective_api_key)

# ══════════════════════════════════════════════════════════════════════
# HERO & MAIN UI COMPONENT WITH SUNRISE BACKGROUND
# ══════════════════════════════════════════════════════════════════════
latency_val = str(st.session_state.get("last_latency", "174"))
voice_short = selected_voice.split("(")[0].strip()

bg_style = f"background: linear-gradient(180deg, rgba(4, 13, 7, 0.45) 0%, rgba(4, 13, 7, 0.88) 100%), url('data:image/jpeg;base64,{sunrise_bg_b64}') center/cover no-repeat;" if sunrise_bg_b64 else "background: #040D07;"

hero_html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{
    font-family: 'Plus Jakarta Sans', sans-serif;
    background: #040D07;
    color: #F8FAFC;
    overflow-x: hidden;
}}

.hero-wrapper {{
    position: relative;
    padding: 40px 45px 30px 45px;
    display: flex;
    gap: 30px;
    align-items: center;
    justify-content: space-between;
    {bg_style}
    border-bottom: 1px solid rgba(34, 197, 94, 0.25);
    box-shadow: inset 0 -30px 60px rgba(4, 13, 7, 0.9);
}}

.hero-content {{ flex: 1.2; max-width: 680px; z-index: 2; }}

.badge {{
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(34, 197, 94, 0.18);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(34, 197, 94, 0.45);
    color: #4ADE80;
    padding: 6px 16px; border-radius: 100px;
    font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
    margin-bottom: 16px;
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.25);
}}

.hero-title {{
    font-size: 60px; font-weight: 900; line-height: 1.05; letter-spacing: -1.5px; color: #FFFFFF;
    text-shadow: 0 4px 20px rgba(0,0,0,0.5);
}}
.hero-title span {{
    background: linear-gradient(135deg, #BEF264 0%, #22C55E 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}}
.hero-subtitle {{
    font-size: 24px; font-weight: 800; color: #E2E8F0; margin-top: 8px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.6);
}}
.hero-desc {{
    font-size: 15px; color: #E2E8F0; line-height: 1.65; margin-top: 14px; max-width: 580px;
    text-shadow: 0 2px 8px rgba(0,0,0,0.7);
}}

/* Trust Pills */
.pill-grid {{
    display: flex; gap: 10px; flex-wrap: wrap; margin-top: 22px;
}}
.pill-item {{
    background: rgba(10, 25, 16, 0.75);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 8px 14px; border-radius: 12px;
    font-size: 12px; font-weight: 600; color: #F1F5F9;
    display: flex; align-items: center; gap: 6px;
    transition: all 0.3s ease;
}}
.pill-item:hover {{
    border-color: rgba(190, 242, 100, 0.6);
    background: rgba(34, 197, 94, 0.15);
}}

/* Hero Image Container */
.hero-visual {{
    flex: 1; position: relative; display: flex; flex-direction: column; align-items: flex-end; z-index: 2;
}}
.speech-bubble {{
    background: rgba(255, 255, 255, 0.96);
    border: 2px solid #22C55E;
    border-radius: 20px; border-bottom-right-radius: 4px;
    padding: 14px 20px; color: #0F172A;
    box-shadow: 0 10px 30px rgba(34, 197, 94, 0.3);
    max-width: 310px; margin-bottom: -15px; z-index: 3;
    animation: floatBubble 4s ease-in-out infinite alternate;
}}
@keyframes floatBubble {{
    0% {{ transform: translateY(0); }} 100% {{ transform: translateY(-8px); }}
}}
.speech-bubble h4 {{ font-size: 16px; font-weight: 800; color: #15803D; margin-bottom: 2px; }}
.speech-bubble p {{ font-size: 13px; font-weight: 500; color: #334155; line-height: 1.4; }}

.farmer-card {{
    position: relative; border-radius: 24px; overflow: hidden;
    border: 2px solid rgba(190, 242, 100, 0.4);
    box-shadow: 0 20px 50px rgba(0,0,0,0.8);
    max-width: 440px; width: 100%;
}}
.farmer-card img {{ width: 100%; display: block; }}

/* ── BENTO FEATURE GRID ── */
.bento-section {{
    padding: 24px 45px 24px 45px;
}}
.bento-grid {{
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px;
}}
.bento-card {{
    background: linear-gradient(135deg, rgba(15, 35, 22, 0.75) 0%, rgba(7, 20, 13, 0.85) 100%);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(34, 197, 94, 0.25);
    border-radius: 20px; padding: 20px 16px; text-align: center;
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}}
.bento-card:hover {{
    transform: translateY(-6px);
    border-color: #BEF264;
    box-shadow: 0 12px 30px rgba(34, 197, 94, 0.3);
    background: linear-gradient(135deg, rgba(20, 45, 28, 0.9) 0%, rgba(10, 28, 18, 0.95) 100%);
}}
.bento-icon {{ font-size: 34px; margin-bottom: 8px; display: block; }}
.bento-title {{ font-size: 15px; font-weight: 800; color: #F8FAFC; margin-bottom: 4px; }}
.bento-desc {{ font-size: 12px; color: #94A3B8; line-height: 1.4; }}

/* ── STATUS MATRIX ── */
.status-bar {{
    margin: 0 45px 20px 45px;
    background: rgba(10, 24, 16, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(34, 197, 94, 0.25);
    border-radius: 18px; padding: 14px 24px;
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;
}}
.status-pill {{
    display: flex; align-items: center; justify-content: center; gap: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px; padding: 10px;
}}
.status-dot {{ width: 8px; height: 8px; background: #22C55E; border-radius: 50%; box-shadow: 0 0 10px #22C55E; }}
.status-label {{ font-size: 11px; color: #94A3B8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }}
.status-val {{ font-size: 13px; color: #F8FAFC; font-weight: 800; font-family: 'JetBrains Mono', monospace; }}

/* Footer */
.footer-strip {{
    padding: 16px 45px; background: #020804;
    border-top: 1px solid rgba(34, 197, 94, 0.15);
    display: flex; justify-between; align-items: center;
    font-size: 13px; font-weight: 600; color: #64748B;
}}
.footer-strip a {{ color: #38BDF8; text-decoration: none; font-weight: 700; }}
</style>
</head>
<body>

<div class="hero-wrapper">
    <div class="hero-content">
        <div class="badge">🇮🇳 VOICE FOR BHARAT EDITION • FARM &amp; FIELD</div>
        <h1 class="hero-title">Kisan <span>Vani</span></h1>
        <div class="hero-subtitle">AI Voice Companion for Farmers</div>
        <p class="hero-desc">Your intelligent agricultural partner. Speak naturally in Indian regional languages to get live mandi prices, hyper-local weather forecasts, crop disease prevention, and government subsidy guides.</p>
        
        <div class="pill-grid">
            <div class="pill-item">🌾 15 Regional Indian Voices</div>
            <div class="pill-item">⚡ Sub-100ms Falcon 2 Latency</div>
            <div class="pill-item">🛡️ Enterprise Agri-LLM Engine</div>
            <div class="pill-item">💚 Built for 140M+ Indian Farmers</div>
        </div>
    </div>

    <div class="hero-visual">
        <div class="speech-bubble">
            <h4>Namaste Farmer! 🌾</h4>
            <p>I am here to guide you with real-time crop care and weather insights today.</p>
        </div>
        <div class="farmer-card">
            {"<img src='data:image/png;base64," + farmer_b64 + "' alt='Kisan Vani AI Farmer'/>" if farmer_b64 else ""}
        </div>
    </div>
</div>

<div class="bento-section">
    <div class="bento-grid">
        <div class="bento-card">
            <span class="bento-icon">🌦️</span>
            <div class="bento-title">Weather Forecast</div>
            <div class="bento-desc">Hyper-local rainfall &amp; climate alerts</div>
        </div>
        <div class="bento-card">
            <span class="bento-icon">🌱</span>
            <div class="bento-title">Crop Advice</div>
            <div class="bento-desc">Yield optimization &amp; soil nutrient guides</div>
        </div>
        <div class="bento-card">
            <span class="bento-icon">🐛</span>
            <div class="bento-title">Pest Protection</div>
            <div class="bento-desc">Instant pest diagnostic remedies</div>
        </div>
        <div class="bento-card">
            <span class="bento-icon">🏛️</span>
            <div class="bento-title">Govt Schemes</div>
            <div class="bento-desc">Subsidies, PM-Kisan &amp; insurance support</div>
        </div>
        <div class="bento-card">
            <span class="bento-icon">📈</span>
            <div class="bento-title">Mandi Prices</div>
            <div class="bento-desc">Live regional market commodity rates</div>
        </div>
    </div>
</div>

<div class="status-bar">
    <div class="status-pill">
        <div class="status-dot"></div>
        <div>
            <div class="status-label">Murf API</div>
            <div class="status-val">{"CONNECTED" if is_connected else "DISCONNECTED"}</div>
        </div>
    </div>
    <div class="status-pill">
        <div class="status-dot"></div>
        <div>
            <div class="status-label">Voice Engine</div>
            <div class="status-val">Falcon 2</div>
        </div>
    </div>
    <div class="status-pill">
        <div class="status-dot"></div>
        <div>
            <div class="status-label">Agri Agent</div>
            <div class="status-val">Online</div>
        </div>
    </div>
    <div class="status-pill">
        <div class="status-dot"></div>
        <div>
            <div class="status-label">Latency</div>
            <div class="status-val">{latency_val} ms</div>
        </div>
    </div>
    <div class="status-pill">
        <div class="status-dot"></div>
        <div>
            <div class="status-label">Selected Voice</div>
            <div class="status-val">{voice_short}</div>
        </div>
    </div>
</div>

<div class="footer-strip">
    <div>🌾 Kisan Vani — Powered by Murf Falcon 2</div>
    <div>Made with ❤️ for Bharat Farmers</div>
    <div><a href="#">GitHub</a> &nbsp;•&nbsp; <a href="#">LinkedIn</a> &nbsp;•&nbsp; <a href="#">Discord</a></div>
</div>

</body>
</html>
"""

components.html(hero_html, height=780, scrolling=False)

# ══════════════════════════════════════════════════════════════════════
# INTERACTIVE AGENT CONSOLE
# ══════════════════════════════════════════════════════════════════════
st.markdown("<h3 style='margin-left:45px;color:#F8FAFC;'>🎙️ Ask Kisan Vani AI Agent</h3>", unsafe_allow_html=True)

preset_queries = [
    "Select a farming question preset...",
    "Namaste! What is the crop weather forecast and pest alert for wheat today?",
    "How can small farmers apply for soil health cards under Pradhan Mantri schemes?",
    "What are the best organic fertilizers to increase mustard crop yield?",
    "Show me today's mandi market prices for tomatoes and potatoes.",
]

col_select, col_empty = st.columns([4, 1])
with col_select:
    selected_preset = st.selectbox("⚡ Quick Command Presets:", preset_queries, label_visibility="collapsed")

default_text = "" if selected_preset.startswith("Select") else selected_preset

col_input, col_action = st.columns([4, 1])
with col_input:
    user_input = st.text_area(
        "Ask Question",
        value=default_text,
        height=85,
        placeholder="Type your question about farming, weather, pests, or mandi prices here...",
        label_visibility="collapsed",
    )

with col_action:
    st.write(" ")
    talk_btn = st.button("🎙️ Talk to AI", type="primary", use_container_width=True)

if talk_btn:
    murf_engine = MurfFalconEngine(api_key=effective_api_key)
    is_valid, err_msg = murf_engine.validate_key()

    if not user_input.strip():
        st.warning("⚠️ Please enter a question or select a preset.")
    elif not is_valid:
        st.error(f"❌ {err_msg}")
    else:
        with st.spinner("Synthesizing response with Murf Falcon 2…"):
            try:
                llm = AgriLLMEngine()
                ai_text = llm.generate_response(user_input)
                audio_bytes, latency_ms, voice_id = murf_engine.synthesize_speech(
                    text=ai_text, voice_name=selected_voice
                )
                st.session_state["last_latency"] = latency_ms
                st.audio(audio_bytes, format="audio/mp3", autoplay=True)
                st.success(f"**Agent Response:** {ai_text}")
                st.info(f"⚡ **Latency:** `{latency_ms} ms` · **Voice Model:** Murf Falcon 2 (`{voice_id}`)")
            except Exception as e:
                st.error(f"❌ Synthesis Error: {str(e)}")
