"""FastAPI entrypoint for Roadmapify."""

from dotenv import load_dotenv

load_dotenv()

import json
import logging
import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

app = FastAPI(title="Roadmapify API", version="0.1.0")


class GenerateRoadmapRequest(BaseModel):
    goal: str = Field(..., min_length=1, description="Learning goal for the roadmap.")


def _sample_roadmap(goal: str) -> dict[str, Any]:
    """Deterministic fallback when the RAG + LLM pipeline is unavailable."""
    return {
        "goal": goal,
        "status": "sample",
        "message": (
            "Pipeline unavailable (missing GEMINI_API_KEY, ChromaDB/embedder error, or LLM failure). "
            "Set GEMINI_API_KEY in backend/.env and ensure ChromaDB is populated for full RAG output."
        ),
        "phases": [
            {
                "title": "Foundations",
                "weeks": "1-2",
                "topics": ["Core concepts", "Tools setup", "First small project"],
            },
            {
                "title": "Practice",
                "weeks": "3-6",
                "topics": ["Guided exercises", "Mini projects", "Review mistakes"],
            },
            {
                "title": "Build and ship",
                "weeks": "7+",
                "topics": ["Portfolio project", "Peer feedback", "Iterate"],
            },
        ],
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate-roadmap")
async def generate_roadmap(body: GenerateRoadmapRequest) -> dict[str, Any]:
    """Return a learning roadmap JSON for the given goal (RAG + Gemini when configured)."""
    goal = body.goal.strip()
    if not os.getenv("GEMINI_API_KEY", "").strip():
        return _sample_roadmap(goal)

    try:
        from backend.rag.roadmap_chain import generate_roadmap as chain_generate

        raw = chain_generate(goal)
        if not raw or not str(raw).strip():
            return _sample_roadmap(goal)
        text = str(raw).strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return {
                "goal": goal,
                "status": "parse_error",
                "message": "Model returned non-JSON text.",
                "raw": text,
            }
        if isinstance(data, dict):
            data.setdefault("goal", goal)
            data.setdefault("status", "generated")
            return data
        return {"goal": goal, "status": "generated", "data": data}
    except Exception as exc:  # noqa: BLE001
        logger.exception("generate-roadmap failed: %s", exc)
        out = _sample_roadmap(goal)
        out["status"] = "error"
        out["error"] = str(exc)
        return out
