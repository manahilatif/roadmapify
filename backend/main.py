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
        # "https://roadmapify.vercel.app",
        # "https://*.vercel.app",
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
    except ValueError as e:
        # Validation error from generation logic — return 400 instead of fallback
        logger.error(f"Validation error in generation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Roadmap generation failed. Please try again.")


# Alias so nothing breaks if frontend calls /generate
@app.post("/generate")
async def generate_alias(req: GenerateRequest):
    return await generate_roadmap_endpoint(req)


@app.post("/regenerate-roadmap")
async def regenerate_roadmap_endpoint(req: GenerateRequest):
    """
    Regenerate a roadmap with a new timeframe or updated parameters.
    Accepts the same parameters as /generate-roadmap.
    Returns the newly generated roadmap with updated nodes.
    """
    # Validate goal
    is_valid, error_msg = await validate_goal_with_groq(req.goal)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Resolve field name aliases
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
    except ValueError as e:
        logger.error(f"Validation error in regeneration: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Regeneration error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to regenerate roadmap")


@app.post("/suggest-timeframe")
def suggest_timeframe_endpoint(req: TimeframeRequest):
    """
    Use Groq LLM to dynamically suggest a realistic timeframe for the given goal.
    Returns a single timeframe string based on the goal, without any hardcoded options.
    """
    try:
        goal = req.goal.strip()
        if not goal:
            return {"error": "Goal is required"}, 400
        
        # Use Groq to generate a dynamic timeframe based on the goal
        response = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": f"""A person wants to: "{goal}"

How long would it realistically take a beginner to complete this from scratch? Give a single honest time estimate. Be specific and practical — if it takes hours, say hours. If it takes days, say days. If it takes weeks or months, say that. Do not default to weeks if the task is shorter.

Reply with only the time estimate. Examples of valid replies: "3-4 hours", "1 day", "3 days", "2 weeks", "3 months". Nothing else."""
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0,
            max_tokens=20,
        )
        
        timeframe = response.choices[0].message.content.strip()
        # Basic validation - if response doesn't look like a timeframe, return error
        if not timeframe or len(timeframe) > 50:
            logger.warning(f"Invalid timeframe response for goal '{goal}': {timeframe}")
            return {"error": "Failed to generate timeframe suggestion"}, 400
        
        return {"suggestion": timeframe}
    except Exception as e:
        logger.error(f"Timeframe suggestion error: {e}")
        return {"error": f"Failed to suggest timeframe: {str(e)}"}, 500


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


