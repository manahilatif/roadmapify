"""FastAPI entrypoint for Roadmapify."""
import sys
import pathlib
import logging

ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(dotenv_path=pathlib.Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Roadmapify API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://roadmapify-tan.vercel.app",
        "https://roadmapify.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy imports
_generate_fn  = None
_chat_fn      = None

def get_generate():
    global _generate_fn
    if _generate_fn is None:
        try:
            from backend.rag.roadmap_chain import generate_roadmap
            _generate_fn = generate_roadmap
        except ImportError:
            sys.path.insert(0, str(ROOT / "backend" / "rag"))
            from roadmap_chain import generate_roadmap
            _generate_fn = generate_roadmap
    return _generate_fn

def get_chat():
    global _chat_fn
    if _chat_fn is None:
        try:
            from backend.rag.roadmap_chain import chat_with_roadmap
            _chat_fn = chat_with_roadmap
        except ImportError:
            sys.path.insert(0, str(ROOT / "backend" / "rag"))
            from roadmap_chain import chat_with_roadmap
            _chat_fn = chat_with_roadmap
    return _chat_fn


# ── Request models ────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    goal:            str = Field(..., min_length=1)
    # Accept every field name variant the frontend might send
    difficulty:      Optional[str] = "beginner"
    time_commitment: Optional[str] = "1 month"
    experience:      Optional[str] = None
    timeframe:       Optional[str] = None
    level:           Optional[str] = None
    domain:          Optional[str] = "general"
    hours_per_week:  Optional[int] = 10
    learning_style:  Optional[str] = "mixed"

class ChatMessage(BaseModel):
    role:    str
    content: str

class ChatRequest(BaseModel):
    message:          str
    roadmap:          dict
    current_module:   Optional[dict] = None
    current_resource: Optional[dict] = None
    history:          List[ChatMessage] = []

class ProgressRequest(BaseModel):
    roadmap_id: str
    module_id:  str
    completed:  bool
    notes:      str = ""


_progress: dict = {}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "Roadmapify API", "version": "2.0.0", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-roadmap")
def generate_roadmap_endpoint(req: GenerateRequest):
    # Resolve all field name aliases to the two params roadmap_chain expects
    difficulty      = req.difficulty or req.experience or req.level or "beginner"
    time_commitment = req.time_commitment or req.timeframe or "1 month"

    try:
        fn     = get_generate()
        result = fn(
            goal=req.goal,
            difficulty=difficulty,
            time_commitment=time_commitment,
        )
        return result
    except Exception as e:
        logger.error(f"Generation error: {e}", exc_info=True)
        return _fallback(req.goal)


# Alias so nothing breaks if frontend calls /generate
@app.post("/generate")
def generate_alias(req: GenerateRequest):
    return generate_roadmap_endpoint(req)


@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    try:
        fn    = get_chat()
        reply = fn(
            user_message=req.message,
            roadmap_context=req.roadmap,
            current_module=req.current_module,
            current_resource=req.current_resource,
            chat_history=[{"role": m.role, "content": m.content} for m in req.history],
        )
        return {"success": True, "reply": reply}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return {"success": False, "reply": "Sorry, I couldn't connect right now. Please try again."}


@app.post("/progress")
def update_progress(req: ProgressRequest):
    if req.roadmap_id not in _progress:
        _progress[req.roadmap_id] = {}
    _progress[req.roadmap_id][req.module_id] = {"completed": req.completed, "notes": req.notes}
    done  = sum(1 for v in _progress[req.roadmap_id].values() if v["completed"])
    total = len(_progress[req.roadmap_id])
    return {"success": True, "completed": done, "total": total,
            "percentage": round(done / total * 100) if total else 0}

@app.get("/progress/{roadmap_id}")
def get_progress(roadmap_id: str):
    p     = _progress.get(roadmap_id, {})
    done  = sum(1 for v in p.values() if v["completed"])
    total = len(p)
    return {"roadmap_id": roadmap_id, "progress": p, "completed": done,
            "total": total, "percentage": round(done / total * 100) if total else 0}


def _fallback(goal: str) -> dict:
    return {
        "title":       f"{goal} Roadmap",
        "description": "A personalized learning journey",
        "total_xp":    500,
        "nodes": [
            {
                "id": "node_1", "title": "Foundation",
                "description": "Start with the fundamentals.",
                "type": "main", "emoji": "🚀",
                "duration_label": "Week 1-2", "xp_reward": 100,
                "status": "active",
                "resources": [
                    {"label": "freeCodeCamp", "url": "https://www.freecodecamp.org", "tip": "Free and comprehensive"},
                    {"label": "MDN Web Docs",  "url": "https://developer.mozilla.org", "tip": "Official reference"},
                ],
            },
            {
                "id": "node_2", "title": "Core Skills",
                "description": "Key techniques and practice.",
                "type": "main", "emoji": "⚙️",
                "duration_label": "Week 3-5", "xp_reward": 100,
                "status": "locked", "resources": [],
            },
            {
                "id": "node_3", "title": "Build something",
                "description": "Apply your knowledge to a real project.",
                "type": "main", "emoji": "🛠",
                "duration_label": "Week 6+", "xp_reward": 150,
                "status": "locked", "resources": [],
            },
            {
                "id": "bonus_1", "title": "Go deeper",
                "description": "Advanced challenge for those who want more.",
                "type": "bonus", "emoji": "⭐",
                "duration_label": "Anytime", "xp_reward": 250,
                "status": "locked", "resources": [],
            },
        ],
    }