"""
main.py — Roadmapify FastAPI Backend
All 10 features implemented:
1. Roadmap generation (goal-based, personalized)
2. Architecture recommendations
3. Multi-domain support
4. Task-based breakdown
5. Timeline planning
6. Checkpoint practice
7. Resource recommendations
8. Context-aware chatbot
9. Dynamic roadmap updates
10. Progress tracking
"""
import os
import sys
import json
import pathlib
from datetime import datetime
from typing import Optional, List

ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(dotenv_path=pathlib.Path(__file__).parent / ".env")

# ── App setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Roadmapify API",
    description="AI-powered personalized learning roadmap generator",
    version="1.0.0",
)

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

# ── Lazy import chain (avoids startup crash if ChromaDB not populated yet) ───
_chain_module = None

def get_chain():
    global _chain_module
    if _chain_module is None:
        try:
            from backend.rag.roadmap_chain import generate_roadmap, chat_with_roadmap
            _chain_module = {"generate": generate_roadmap, "chat": chat_with_roadmap}
        except ImportError:
            try:
                sys.path.insert(0, str(ROOT / "backend" / "rag"))
                from roadmap_chain import generate_roadmap, chat_with_roadmap
                _chain_module = {"generate": generate_roadmap, "chat": chat_with_roadmap}
            except ImportError as e:
                raise RuntimeError(f"Cannot import roadmap chain: {e}")
    return _chain_module


# ── Request / Response models ────────────────────────────────────────────────

class RoadmapRequest(BaseModel):
    goal: str
    domain: str = "general"
    level: str = "beginner"
    hours_per_week: int = 10
    learning_style: str = "mixed"
    context_extra: str = ""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    roadmap: dict
    current_module: Optional[dict] = None
    current_resource: Optional[dict] = None
    history: List[ChatMessage] = []


class ProgressUpdate(BaseModel):
    roadmap_id: str
    module_id: int
    completed: bool
    notes: str = ""


class RoadmapUpdateRequest(BaseModel):
    original_roadmap: dict
    change_type: str  # "pace", "goal", "difficulty", "add_module"
    new_value: str
    hours_per_week: Optional[int] = None


# ── In-memory progress store (replace with DB in production) ─────────────────
_progress_store: dict = {}


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "Roadmapify API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/generate",
            "/chat",
            "/progress",
            "/update-roadmap",
            "/checkpoint/{module_id}",
            "/health",
        ]
    }


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/generate")
def generate_roadmap_endpoint(req: RoadmapRequest):
    """
    Feature 1, 2, 3, 4, 5, 6, 7:
    Generate a complete personalized roadmap with architecture advice,
    multi-domain support, task breakdown, timeline, checkpoints, and resources.
    """
    try:
        chain = get_chain()
        roadmap = chain["generate"](
            goal=req.goal,
            domain=req.domain,
            level=req.level,
            hours_per_week=req.hours_per_week,
            learning_style=req.learning_style,
            context_extra=req.context_extra,
        )

        # Ensure all resource URLs are real/valid (fallback if LLM gave placeholder)
        roadmap = _sanitize_resources(roadmap, req.domain, req.goal)

        return {"success": True, "roadmap": roadmap}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roadmap generation failed: {str(e)}")


@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    """
    Feature 8: Context-aware AI chatbot.
    Knows which module and resource the user is on.
    """
    try:
        chain = get_chain()
        history = [{"role": m.role, "content": m.content} for m in req.history]
        reply = chain["chat"](
            user_message=req.message,
            roadmap_context=req.roadmap,
            current_module=req.current_module,
            current_resource=req.current_resource,
            chat_history=history,
        )
        return {"success": True, "reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.post("/progress")
def update_progress(update: ProgressUpdate):
    """
    Feature 10: Mark tasks complete, track progress.
    """
    key = update.roadmap_id
    if key not in _progress_store:
        _progress_store[key] = {}

    _progress_store[key][str(update.module_id)] = {
        "completed": update.completed,
        "notes": update.notes,
        "timestamp": datetime.utcnow().isoformat(),
    }

    completed_count = sum(1 for v in _progress_store[key].values() if v["completed"])
    total = len(_progress_store[key])

    return {
        "success": True,
        "progress": _progress_store[key],
        "summary": {
            "completed": completed_count,
            "total": total,
            "percentage": round(completed_count / total * 100) if total > 0 else 0,
        }
    }


@app.get("/progress/{roadmap_id}")
def get_progress(roadmap_id: str):
    """Get current progress for a roadmap."""
    progress = _progress_store.get(roadmap_id, {})
    completed = sum(1 for v in progress.values() if v["completed"])
    total = len(progress)
    return {
        "roadmap_id": roadmap_id,
        "progress": progress,
        "summary": {
            "completed": completed,
            "total": total,
            "percentage": round(completed / total * 100) if total > 0 else 0,
        }
    }


@app.post("/update-roadmap")
def update_roadmap_endpoint(req: RoadmapUpdateRequest):
    """
    Feature 9: Dynamic roadmap updates without starting from scratch.
    Adjusts pace, difficulty, or adds modules intelligently.
    """
    try:
        chain = get_chain()
        original = req.original_roadmap

        if req.change_type == "pace":
            new_hours = req.hours_per_week or int(req.new_value)
            updated = chain["generate"](
                goal=original.get("goal", ""),
                domain=original.get("domain", "general"),
                level=original.get("level", "beginner"),
                hours_per_week=new_hours,
                context_extra=f"This is an update. Keep the same structure but adjust the timeline for {new_hours} hours/week. Preserve completed modules.",
            )
        elif req.change_type == "difficulty":
            updated = chain["generate"](
                goal=original.get("goal", ""),
                domain=original.get("domain", "general"),
                level=req.new_value,
                hours_per_week=original.get("timeline", {}).get("hoursPerWeek", 10),
                context_extra=f"Adjust difficulty to {req.new_value} level. Keep overall goal the same.",
            )
        elif req.change_type == "add_module":
            updated = chain["generate"](
                goal=original.get("goal", ""),
                domain=original.get("domain", "general"),
                level=original.get("level", "beginner"),
                hours_per_week=original.get("timeline", {}).get("hoursPerWeek", 10),
                context_extra=f"Add a new module about: {req.new_value}. Keep all existing modules and append the new one.",
            )
        else:
            updated = chain["generate"](
                goal=req.new_value,
                domain=original.get("domain", "general"),
                level=original.get("level", "beginner"),
                hours_per_week=original.get("timeline", {}).get("hoursPerWeek", 10),
            )

        updated = _sanitize_resources(updated, updated.get("domain", ""), updated.get("goal", ""))
        return {"success": True, "roadmap": updated}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roadmap update failed: {str(e)}")


@app.get("/checkpoint/{module_id}")
def get_checkpoint_questions(module_id: int, goal: str = "", domain: str = ""):
    """
    Feature 6: Generate checkpoint practice questions for a module.
    """
    try:
        chain = get_chain()
        # Use chat function to generate targeted questions
        question_prompt = f"Generate 5 practice questions and 1 mini-project for module {module_id} in a {domain} roadmap for goal: {goal}. Format as JSON with keys: questions (list) and miniProject (string)."
        response = chain["chat"](
            user_message=question_prompt,
            roadmap_context={"goal": goal, "domain": domain},
            current_module={"id": module_id},
            current_resource=None,
            chat_history=[],
        )
        # Try to parse as JSON, else return raw
        try:
            data = json.loads(response)
        except Exception:
            data = {"questions": [], "miniProject": response}
        return {"success": True, "checkpoint": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Resource sanitizer ───────────────────────────────────────────────────────

DOMAIN_RESOURCES = {
    "web development": [
        {"title": "The Odin Project", "url": "https://www.theodinproject.com", "type": "platform"},
        {"title": "MDN Web Docs", "url": "https://developer.mozilla.org", "type": "documentation"},
        {"title": "freeCodeCamp Web Dev", "url": "https://www.freecodecamp.org/learn", "type": "platform"},
        {"title": "JavaScript.info", "url": "https://javascript.info", "type": "article"},
        {"title": "CSS Tricks", "url": "https://css-tricks.com", "type": "article"},
    ],
    "python": [
        {"title": "Python Official Docs", "url": "https://docs.python.org/3/", "type": "documentation"},
        {"title": "Real Python", "url": "https://realpython.com", "type": "article"},
        {"title": "Python for Everybody - freeCodeCamp", "url": "https://www.youtube.com/watch?v=8DvywoWv6fI", "type": "video"},
        {"title": "Automate the Boring Stuff", "url": "https://automatetheboringstuff.com", "type": "book"},
    ],
    "data science": [
        {"title": "Kaggle Learn", "url": "https://www.kaggle.com/learn", "type": "platform"},
        {"title": "fast.ai", "url": "https://www.fast.ai", "type": "platform"},
        {"title": "Towards Data Science", "url": "https://towardsdatascience.com", "type": "article"},
        {"title": "StatQuest YouTube", "url": "https://www.youtube.com/@statquest", "type": "video"},
    ],
    "machine learning": [
        {"title": "Andrew Ng ML Course", "url": "https://www.coursera.org/learn/machine-learning", "type": "platform"},
        {"title": "Scikit-learn Docs", "url": "https://scikit-learn.org/stable/", "type": "documentation"},
        {"title": "fast.ai Practical DL", "url": "https://course.fast.ai", "type": "platform"},
        {"title": "Andrej Karpathy YouTube", "url": "https://www.youtube.com/@AndrejKarpathy", "type": "video"},
    ],
    "design": [
        {"title": "Figma Learning", "url": "https://help.figma.com/hc/en-us/categories/360002051613", "type": "documentation"},
        {"title": "DesignCourse YouTube", "url": "https://www.youtube.com/@DesignCourse", "type": "video"},
        {"title": "Refactoring UI Book", "url": "https://www.refactoringui.com", "type": "book"},
        {"title": "Laws of UX", "url": "https://lawsofux.com", "type": "article"},
    ],
    "general": [
        {"title": "freeCodeCamp", "url": "https://www.freecodecamp.org", "type": "platform"},
        {"title": "Coursera", "url": "https://www.coursera.org", "type": "platform"},
        {"title": "Khan Academy", "url": "https://www.khanacademy.org", "type": "platform"},
        {"title": "YouTube", "url": "https://www.youtube.com", "type": "video"},
    ],
}


def _sanitize_resources(roadmap: dict, domain: str, goal: str) -> dict:
    """Ensure all resource URLs are valid. Replace placeholders with real ones."""
    fallbacks = DOMAIN_RESOURCES.get(domain.lower(), DOMAIN_RESOURCES["general"])

    PLACEHOLDER_PATTERNS = ["example.com", "placeholder", "yoursite", "#", "N/A", ""]

    for module in roadmap.get("modules", []):
        sanitized = []
        for i, res in enumerate(module.get("resources", [])):
            url = res.get("url", "")
            is_placeholder = any(p in url.lower() for p in PLACEHOLDER_PATTERNS) or not url.startswith("http")
            if is_placeholder and fallbacks:
                fb = fallbacks[i % len(fallbacks)]
                res = {**res, "url": fb["url"], "title": res.get("title") or fb["title"]}
            sanitized.append(res)
        module["resources"] = sanitized

    return roadmap