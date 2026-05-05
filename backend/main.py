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

from backend.rag.roadmap_chain import generate_roadmap

logger = logging.getLogger(__name__)

app = FastAPI(title="Roadmapify API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://roadmapify-tan.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRoadmapRequest(BaseModel):
    goal: str = Field(..., min_length=1)
    experience: str = Field(default="beginner")   # replaces difficulty
    timeframe: str = Field(default="1_month")     # replaces time_commitment


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.post("/generate-roadmap")
def generate_roadmap_endpoint(req: GenerateRoadmapRequest):
    try:
        result = generate_roadmap(
            goal=req.goal,
            timeframe=req.timeframe,
            experience=req.experience,
        )
        return result  # roadmap_chain now returns the full structured dict directly
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        return {
            "title": f"Roadmap for: {req.goal}",
            "goal_type": "skill",
            "total_xp": 300,
            "timeframe_options": [
                {"label": "2 weeks", "sublabel": "Sprint", "value": "2_weeks"},
                {"label": "1 month", "sublabel": "Steady", "value": "1_month"},
                {"label": "3 months", "sublabel": "Deep dive", "value": "3_months"},
            ],
            "nodes": [
                {
                    "id": "node_1",
                    "title": "Get started",
                    "description": "Begin your journey with the basics.",
                    "duration_label": "Day 1",
                    "status": "active",
                    "type": "main",
                    "xp_reward": 100,
                    "emoji": "🚀",
                    "resources": [
                        {"label": "Search for beginner guides", "url": "", "tip": "Start with YouTube or Google"}
                    ],
                },
                {
                    "id": "bonus_1",
                    "title": "Challenge yourself",
                    "description": "Try something more advanced once you're comfortable.",
                    "duration_label": "Whenever you're ready",
                    "status": "locked",
                    "type": "bonus",
                    "xp_reward": 250,
                    "emoji": "⭐",
                    "resources": [],
                },
            ],
        }