"""
main.py
-------
Roadmapify FastAPI backend.
Entry point for all API routes.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Roadmapify API",
    description="AI-powered personalized learning roadmap generator",
    version="1.0.0",
)

# Allow frontend (React on localhost:5173) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Roadmapify API is running"}


@app.post("/generate-roadmap")
def generate(payload: dict):
    """
    Generate a personalized learning roadmap.

    Request body:
        { "goal": "I want to learn web development as a beginner" }

    Returns:
        { "roadmap": "<JSON string>" }
    """
    from backend.rag.roadmap_chain import generate_roadmap

    user_input = payload.get("goal", "").strip()

    if not user_input:
        return {"error": "No goal provided. Send a JSON body with a 'goal' field."}

    result = generate_roadmap(user_input)
    return {"roadmap": result}