"""FastAPI entrypoint for Roadmapify."""
import sys
import pathlib
import logging
import re
import os

ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(dotenv_path=pathlib.Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from groq import Groq

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

# Initialize Groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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


async def validate_goal_with_groq(goal: str) -> tuple[bool, str]:
    """
    Use Groq API to validate if the goal is a real, learnable skill/goal.
    Returns: (is_valid, error_message)
    """
    try:
        if not goal or len(goal.strip()) < 2:
            return False, "Please enter a learning goal."
        
        # Use Groq for quick validation with llama-3.1-8b-instant (fast & cheap)
        response = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": f'Is the following a valid, specific, and learnable skill or goal that a person could realistically study or prepare for? Answer with only "yes" or "no".\n\nGoal: "{goal.strip()}"'
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0,
            max_tokens=5,
        )
        
        answer = response.choices[0].message.content.strip().lower()
        
        # Check if the response is "no"
        if "no" in answer:
            return False, "This doesn't look like a learnable goal. Try something like 'Learn Python', 'Prepare for IELTS', or 'Get started with machine learning'."
        
        return True, ""
    except Exception as e:
        logger.error(f"Groq validation error: {e}")
        # Fall back to local validation on API error
        return True, ""


def validate_learning_goal(goal: str) -> tuple[bool, str]:
    """
    Validate whether the input is a legitimate learning goal.
    Returns: (is_valid, error_message)
    
    A valid goal is something a person can realistically learn or prepare for.
    Invalid goals are: vague nonsense, offensive, too short, random characters, etc.
    """
    if not goal or len(goal.strip()) == 0:
        return False, "Please enter a learning goal."
    
    goal = goal.strip()
    
    # Check minimum length
    if len(goal) < 4:
        return False, "Your goal is too short. Try something like 'Learn Python' or 'Prepare for IELTS'."
    
    # Check for mostly random characters or nonsense patterns
    # (very few vowels, too many repeated chars, keyboard smash)
    vowel_count = sum(1 for c in goal.lower() if c in 'aeiou')
    vowel_ratio = vowel_count / len(goal) if goal else 0
    if vowel_ratio < 0.15 and len(goal) > 6:
        # Too few vowels for a normal goal
        return False, "This doesn't look like a learning goal. Try something like 'Learn Python' or 'Prepare for IELTS'."
    
    # Check for offensive words (simple blacklist)
    offensive_words = ['kill', 'hate', 'die', 'attack', 'bomb', 'harm']
    goal_lower = goal.lower()
    if any(word in goal_lower for word in offensive_words):
        return False, "Please enter a respectful learning goal."
    
    # Check if it looks like a real goal (contains relevant keywords/patterns)
    # Valid patterns: learn, prepare, master, build, understand, get better, study, practice, etc.
    valid_patterns = [
        r'\b(learn|master|study|practice|prepare|understand|build|create|develop|improve|get|become|pass|complete|finish)\b',
        r'\b(python|javascript|react|vue|node|java|c\+\+|c#|rust|golang|ruby|php)\b',
        r'\b(exam|test|ielts|toefl|gre|gmat|sat|act|certification)\b',
        r'\b(course|curriculum|skill|tutorial|guide|roadmap|project|app|website|system)\b',
        r'\bfor\b',  # "Learn X for Y"
    ]
    
    matches_pattern = any(re.search(pattern, goal_lower) for pattern in valid_patterns)
    
    # If no valid patterns matched, it might still be okay if it's clearly about learning something
    # Give it another chance with a simpler check
    if not matches_pattern:
        # Check if it has at least 2 words and doesn't look like random input
        words = goal.split()
        if len(words) < 2:
            return False, "Your goal should be more specific. Try 'Learn Python' instead of just 'Python'."
        
        # Check for too many numbers/special chars
        special_ratio = sum(1 for c in goal if not c.isalnum() and c != ' ') / len(goal)
        if special_ratio > 0.3:
            return False, "This doesn't look like a learning goal. Try something like 'Learn Python' or 'Prepare for IELTS'."
    
    return True, ""


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

class TimeframeRequest(BaseModel):
    goal: str = Field(..., min_length=1)


_progress: dict = {}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"service": "Roadmapify API", "version": "2.0.0", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-roadmap")
async def generate_roadmap_endpoint(req: GenerateRequest):
    # First, validate with Groq (LLM-based validation)
    is_valid, error_msg = await validate_goal_with_groq(req.goal)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
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
async def generate_alias(req: GenerateRequest):
    return await generate_roadmap_endpoint(req)


@app.post("/suggest-timeframe")
def suggest_timeframe_endpoint(req: TimeframeRequest):
    """
    Use Groq LLM to dynamically suggest a realistic timeframe for the given goal.
    Returns a timeframe string that accounts for the complexity and nature of the goal.
    """
    try:
        goal = req.goal.strip()
        if not goal:
            return {"suggested_timeframe": "4-8 weeks"}
        
        # Use Groq to generate a dynamic timeframe based on the goal
        response = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": f"""Estimate a realistic learning or completion timeframe for this specific goal.
Consider:
- If it's a quick task (cake baking, short article), suggest hours or days
- If it's a skill to learn (language, programming), suggest weeks or months
- If it's mastery/deep expertise, suggest months or years

Goal: "{goal}"

Respond with ONLY a timeframe string like "2-3 hours", "1-2 days", "2-4 weeks", "2-3 months", "6-12 months", etc.
Be specific to the goal, not generic. Do not explain, just the timeframe."""
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=20,
        )
        
        timeframe = response.choices[0].message.content.strip()
        # Basic validation - if response doesn't look like a timeframe, use default
        if not timeframe or len(timeframe) > 50:
            return {"suggested_timeframe": "4-8 weeks"}
        
        return {"suggested_timeframe": timeframe}
    except Exception as e:
        logger.error(f"Timeframe suggestion error: {e}")
        return {"suggested_timeframe": "4-8 weeks"}


class UpdateTimeframeRequest(BaseModel):
    roadmap_id: str
    timeframe: str = Field(..., min_length=1)


@app.patch("/roadmap/{roadmap_id}/timeframe")
def update_roadmap_timeframe(roadmap_id: str, req: UpdateTimeframeRequest):
    """
    Update the timeframe for a roadmap.
    For authenticated users, this would update the Firestore document.
    For now, we store it in the in-memory _progress tracking.
    """
    try:
        # In a full implementation, this would:
        # 1. Verify the user owns this roadmap
        # 2. Update the document in Firestore
        # 3. Optionally re-prompt Gemini to regenerate the node schedule
        
        if roadmap_id not in _progress:
            _progress[roadmap_id] = {}
        _progress[roadmap_id]['timeframe'] = req.timeframe
        
        return {
            "success": True,
            "roadmap_id": roadmap_id,
            "new_timeframe": req.timeframe,
            "message": "Roadmap timeframe updated successfully"
        }
    except Exception as e:
        logger.error(f"Timeframe update error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update timeframe")


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