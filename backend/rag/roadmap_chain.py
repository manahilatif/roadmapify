"""
roadmap_chain.py
----------------
LangChain orchestration for Roadmapify.
Retrieves context from ChromaDB, then calls Gemini 1.5 Flash to generate
a structured JSON learning roadmap.
"""

import os
import sys
import pathlib

# Allow imports from project root when run directly
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from backend.rag.rag_pipeline import retrieve_context


# ── LLM setup ─────────────────────────────────────────────────────────────────

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.3,
)


# ── Prompt ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Roadmapify, an expert learning coach and curriculum designer.
Using the retrieved knowledge base content below, generate a structured, personalized learning roadmap.

Retrieved Knowledge:
{context}

Rules:
- Output ONLY a valid JSON object. No explanation, no markdown, no code fences.
- JSON structure must be exactly:
  {{
    "title": "string",
    "description": "string",
    "estimated_total_weeks": number,
    "stages": [
      {{
        "stage_number": number,
        "title": "string",
        "duration_weeks": number,
        "topics": ["string", ...],
        "resources": [
          {{
            "name": "string",
            "url": "string",
            "type": "string"
          }}
        ]
      }}
    ]
  }}
- Be specific, actionable, and realistic about time estimates
- Tailor difficulty and pace to the user's stated experience level
- Only include resources that are real, accessible, and free unless otherwise stated
- Aim for 4-6 stages total
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "{user_input}"),
])

chain = prompt | llm


# ── Main function ─────────────────────────────────────────────────────────────

def generate_roadmap(user_input: str) -> str:
    """
    Generate a structured JSON learning roadmap for the given user input.

    Args:
        user_input: the user's learning goal (e.g. "I want to learn web development")

    Returns:
        A JSON string representing the personalized roadmap.
    """
    context = retrieve_context(user_input)

    response = chain.invoke({
        "context": context,
        "user_input": user_input,
    })

    return response.content


# ── Quick test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_input = "I want to learn web development as a complete beginner"
    print(f"[test] Generating roadmap for: '{test_input}'\n")
    result = generate_roadmap(test_input)
    print(result)