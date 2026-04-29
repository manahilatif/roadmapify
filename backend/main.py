"""FastAPI entrypoint for Roadmapify."""
import pathlib
from dotenv import load_dotenv

load_dotenv(dotenv_path=pathlib.Path(__file__).resolve().parent / ".env")

import json
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

app = FastAPI(title="Roadmapify API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRoadmapRequest(BaseModel):
    goal: str = Field(..., min_length=1)
    difficulty: str = Field(default="beginner")
    time_commitment: str = Field(default="3 months")


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/generate-roadmap")
def generate_roadmap_endpoint(req: GenerateRoadmapRequest):
    try:
        from backend.rag.roadmap_chain import generate_roadmap
        result = generate_roadmap(req.goal, req.difficulty, req.time_commitment)
        return {"goal": req.goal, "status": "success", "roadmap": result}
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        return {
            "goal": req.goal,
            "status": "error",
            "message": str(e),
            "roadmap": {
                "title": f"Roadmap for: {req.goal}",
                "stages": [
                    {
                        "stage_number": 1,
                        "title": "Getting Started",
                        "duration_weeks": 2,
                        "topics": ["Fundamentals", "Setup & Tools"],
                        "resources": ["Search for beginner resources on this topic"],
                    }
                ],
            },
        }