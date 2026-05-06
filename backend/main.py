"""
main.py — Roadmapify FastAPI Backend
"""
import os
import sys
import json
import pathlib
from datetime import datetime
from typing import Optional, List

# ── Path Setup ───────────────────────────────────────────────────────────────
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

# Robust slash handling
app.router.redirect_slashes = True

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

# ── Lazy import chain ────────────────────────────────────────────────────────
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


# ── In-memory progress store ─────────────────────────────────────────────────
_progress_store: dict = {}


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "Roadmapify API",
        "status": "running",
        "endpoints": ["/generate-roadmap", "/chat", "/progress", "/update-roadmap"]
    }


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/generate-roadmap")
def generate_roadmap_endpoint(req: RoadmapRequest):
    """
    Feature: Generate a complete personalized roadmap.
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
        roadmap = _sanitize_resources(roadmap, req.domain, req.goal)
        return {"success": True, "roadmap": roadmap}
    except Exception as e:
        print(f"Deployment Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
def chat_endpoint(req: ChatRequest):
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
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/progress")
def update_progress(update: ProgressUpdate):
    key = update.roadmap_id
    if key not in _progress_store:
        _progress_store[key] = {}

    _progress_store[key][str(update.module_id)] = {
        "completed": update.completed,
        "notes": update.notes,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    vals = _progress_store[key].values()
    completed_count = sum(1 for v in vals if v["completed"])
    total = len(vals)

    return {
        "success": True,
        "summary": {
            "completed": completed_count,
            "total": total,
            "percentage": round(completed_count / total * 100) if total > 0 else 0,
        }
    }


@app.get("/progress/{roadmap_id}")
def get_progress(roadmap_id: str):
    progress = _progress_store.get(roadmap_id, {})
    completed = sum(1 for v in progress.values() if v["completed"])
    total = len(progress)
    return {
        "roadmap_id": roadmap_id,
        "summary": {
            "completed": completed,
            "total": total,
            "percentage": round(completed / total * 100) if total > 0 else 0,
        }
    }


@app.post("/update-roadmap")
def update_roadmap_endpoint(req: RoadmapUpdateRequest):
    try:
        chain = get_chain()
        original = req.original_roadmap
        ctx = f"Update roadmap. Type: {req.change_type}. New value: {req.new_value}"

        updated = chain["generate"](
            goal=original.get("goal", ""),
            domain=original.get("domain", "general"),
            level=original.get("level", "beginner"),
            hours_per_week=req.hours_per_week or original.get("timeline", {}).get("hoursPerWeek", 10),
            context_extra=ctx,
        )
        updated = _sanitize_resources(updated, updated.get("domain", ""), updated.get("goal", ""))
        return {"success": True, "roadmap": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/checkpoint/{module_id}")
def get_checkpoint_questions(module_id: int, goal: str = "", domain: str = ""):
    try:
        chain = get_chain()
        prompt = f"Generate 5 quiz questions for module {module_id} regarding {goal}. Return JSON."
        response = chain["chat"](
            user_message=prompt,
            roadmap_context={"goal": goal, "domain": domain},
            current_module={"id": module_id},
            current_resource=None,
            chat_history=[],
        )
        try:
            data = json.loads(response)
        except:
            data = {"questions": [], "content": response}
        return {"success": True, "checkpoint": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Resource sanitizer ───────────────────────────────────────────────────────

DOMAIN_RESOURCES = {
    "web development": [
        {"title": "The Odin Project", "url": "https://www.theodinproject.com", "type": "platform"},
        {"title": "MDN Web Docs", "url": "https://developer.mozilla.org", "type": "documentation"},
    ],
    "general": [
        {"title": "freeCodeCamp", "url": "https://www.freecodecamp.org", "type": "platform"},
        {"title": "Coursera", "url": "https://www.coursera.org", "type": "platform"},
    ],
}

def _sanitize_resources(roadmap: dict, domain: str, goal: str) -> dict:
    fallbacks = DOMAIN_RESOURCES.get(domain.lower(), DOMAIN_RESOURCES["general"])
    for module in roadmap.get("modules", []):
        sanitized = []
        for i, res in enumerate(module.get("resources", [])):
            url = res.get("url", "")
            if "example.com" in url or not url.startswith("http"):
                fb = fallbacks[i % len(fallbacks)]
                res = {**res, "url": fb["url"], "title": res.get("title") or fb["title"]}
            sanitized.append(res)
        module["resources"] = sanitized
    return roadmap