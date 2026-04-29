"""
roadmap_chain.py
----------------
LangChain orchestration: retrieves context from ChromaDB
then calls Groq (llama3-70b) to generate a structured roadmap.
"""
import sys
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

import os
import json
import pathlib
import re
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

load_dotenv(dotenv_path=pathlib.Path(__file__).resolve().parents[2] / "backend" / ".env")

from backend.rag.rag_pipeline import retrieve_context

# ── LLM setup ────────────────────────────────────────────────────────────────
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.3,
)

SYSTEM_PROMPT = """You are Roadmapify, an expert learning coach.
Using the retrieved knowledge provided, generate a structured, personalized learning roadmap.

Retrieved Knowledge:
{context}

Rules:
- Output ONLY a valid JSON object. No explanation, no markdown, no backticks.
- The JSON must have this exact structure:
{{
  "title": "Roadmap title here",
  "stages": [
    {{
      "stage_number": 1,
      "title": "Stage title",
      "duration_weeks": 2,
      "topics": ["topic1", "topic2"],
      "resources": ["Resource Name - URL or description"]
    }}
  ]
}}
- Include 4-6 stages total
- Be specific and actionable
- Tailor to the user's stated level and time commitment
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "Goal: {user_input}\nDifficulty: {difficulty}\nTime available: {time_commitment}"),
])

chain = prompt | llm


def generate_roadmap(user_input: str, difficulty: str = "beginner", time_commitment: str = "3 months") -> dict:
    """Returns a parsed roadmap dict."""
    context = retrieve_context(user_input)
    response = chain.invoke({
        "context": context,
        "user_input": user_input,
        "difficulty": difficulty,
        "time_commitment": time_commitment,
    })
    raw = response.content.strip()

    # Strip markdown fences if present
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"```$", "", raw).strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Return a safe fallback so the API never crashes
        return {
            "title": f"Roadmap for: {user_input}",
            "stages": [
                {
                    "stage_number": 1,
                    "title": "Getting Started",
                    "duration_weeks": 2,
                    "topics": ["Fundamentals", "Setup"],
                    "resources": ["Search for beginner guides on this topic"],
                }
            ],
        }


if __name__ == "__main__":
    result = generate_roadmap("learn Python as a complete beginner", "beginner", "3 months")
    print(json.dumps(result, indent=2))