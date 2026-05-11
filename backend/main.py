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
from pydantic import BaseModel, Field, ConfigDict
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
    model_config = ConfigDict(extra="ignore")

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
    context_extra:   Optional[str] = None

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
        logger.error(f"Chat error: {type(e).__name__}: {e}")
        err_str = str(e).lower()
        if "rate_limit" in err_str or "429" in err_str:
            msg = "The AI is busy right now (rate limit). Please wait a moment and try again."
        elif "api_key" in err_str or "authentication" in err_str or "401" in err_str:
            msg = "AI service authentication failed. Please check the GROQ_API_KEY in backend/.env."
        elif "model" in err_str and ("not found" in err_str or "invalid" in err_str):
            msg = "The AI model is unavailable. Please check the model name in roadmap_chain.py."
        else:
            msg = "The AI encountered an error. Please try again in a moment."
        return {"success": False, "reply": msg}


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
    g = goal.strip()
    return {
        "title":       f"{g} Roadmap",
        "description": "A personalized step-by-step learning journey",
        "total_xp":    650,
        "nodes": [
            {
                "id": "node_1",
                "title": f"Understand what {g} involves",
                "description": f"Research the full scope of {g} and set clear milestones.",
                "type": "main", "emoji": "🔍",
                "duration_label": "Week 1", "xp_reward": 80,
                "status": "active",
                "steps": [
                    f"Search online for '{g} beginner guide' and read 2-3 overviews",
                    "Write down what skills or knowledge you need to acquire",
                    "Set a measurable goal (e.g. score, project, or certification)",
                    "Find a community or forum related to this topic",
                ],
                "resources": [
                    {"label": "freeCodeCamp", "url": "https://www.freecodecamp.org", "tip": "Free and comprehensive"},
                    {"label": "Reddit learning communities", "url": "https://www.reddit.com/r/learnprogramming", "tip": "Ask questions and find guidance"},
                ],
            },
            {
                "id": "node_2",
                "title": "Set up your learning environment",
                "description": "Install tools, accounts, and materials you need to start.",
                "type": "main", "emoji": "⚙️",
                "duration_label": "Week 1-2", "xp_reward": 80,
                "status": "locked",
                "steps": [
                    "Create any required accounts (e.g. course platforms, official sites)",
                    "Download or install recommended tools and software",
                    "Bookmark key reference sites for quick access",
                    "Set a daily practice schedule in your calendar",
                ],
                "resources": [
                    {"label": "MDN Web Docs", "url": "https://developer.mozilla.org", "tip": "Official reference"},
                    {"label": "The Odin Project", "url": "https://www.theodinproject.com", "tip": "Structured free curriculum"},
                ],
            },
            {
                "id": "node_3",
                "title": "Complete your first practice session",
                "description": "Apply what you learned in a real hands-on exercise.",
                "type": "main", "emoji": "✏️",
                "duration_label": "Week 2-3", "xp_reward": 100,
                "status": "locked",
                "steps": [
                    "Pick one beginner exercise or practice test",
                    "Work through it without help first",
                    "Review your mistakes and note areas to improve",
                    "Repeat with a new exercise the next day",
                ],
                "resources": [
                    {"label": "Kaggle Learn", "url": "https://www.kaggle.com/learn", "tip": "Hands-on micro-courses"},
                ],
            },
            {
                "id": "node_4",
                "title": "Build core skills with focused practice",
                "description": "Drill the key skills needed for your goal.",
                "type": "main", "emoji": "🏋️",
                "duration_label": "Week 3-5", "xp_reward": 120,
                "status": "locked",
                "steps": [
                    "Identify your 2 weakest areas from earlier practice",
                    "Spend 30 min/day on each weak area for one week",
                    "Track your progress with a simple log",
                ],
                "resources": [],
            },
            {
                "id": "node_5",
                "title": "Take a full mock test or build a project",
                "description": "Simulate the real goal to measure your readiness.",
                "type": "main", "emoji": "🎯",
                "duration_label": "Week 5-6", "xp_reward": 150,
                "status": "locked",
                "steps": [
                    "Find a full mock test or project brief matching your goal",
                    "Complete it under realistic conditions (timed if applicable)",
                    "Score or review your output honestly",
                    "List specific improvements for the next attempt",
                ],
                "resources": [],
            },
            {
                "id": "node_6",
                "title": "Review, refine and repeat",
                "description": "Use your mock results to close remaining gaps.",
                "type": "main", "emoji": "🔄",
                "duration_label": "Week 6+", "xp_reward": 120,
                "status": "locked",
                "steps": [
                    "Revisit weakest areas identified from mock test",
                    "Do targeted exercises for each gap",
                    "Take a second mock test to confirm improvement",
                ],
                "resources": [],
            },
            {
                "id": "bonus_1",
                "title": "Go beyond — advanced challenge",
                "description": "Push past your initial goal with an advanced project or stretch target.",
                "type": "bonus", "emoji": "⭐",
                "duration_label": "Anytime", "xp_reward": 250,
                "status": "locked",
                "steps": [
                    "Set a stretch goal 20% harder than your original target",
                    "Find an advanced resource or mentor for this level",
                    "Document your journey and share it with your community",
                ],
                "resources": [],
            },
        ],
    }