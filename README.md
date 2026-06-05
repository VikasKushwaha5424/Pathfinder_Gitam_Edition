# XR-NPC-Project

**WebAR Campus Companion** — an AR-powered campus navigation guide with AI NPCs.

## Structure

```
├── backend/       # Python FastAPI server (STT + LLM + TTS)
│   ├── app.py         # FastAPI app creation
│   ├── main.py        # Entry point
│   ├── models.py      # Pydantic schemas
│   ├── npcs.py        # NPC personality & session management
│   ├── state.py       # Shared app state
│   ├── services/      # STT (Whisper) & TTS (Edge-TTS)
│   ├── routes/        # HTTP + WebSocket endpoints
│   └── requirements.txt
├── web-ui/        # React + Vite + A-Frame frontend
│   └── src/
│       ├── components/  # React components
│       ├── hooks/       # Custom hooks
│       ├── data/        # Shared config/constants
│       └── App.jsx
└── docs/          # Documentation
```

## Quick Start

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
# Add GROQ_API_KEY to backend/.env
python main.py

# Frontend
cd web-ui
npm install
npm run dev
```
