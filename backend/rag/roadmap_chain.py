"""
roadmap_chain.py
----------------
LangChain orchestration: retrieves context from ChromaDB
then calls Groq (llama3-70b) to generate a structured roadmap.
"""
import os
import sys
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(dotenv_path=ROOT / "backend" / ".env")

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

try:
    from backend.rag.rag_pipeline import retrieve_context
except ImportError:
    sys.path.insert(0, str(ROOT / "backend" / "rag"))
    from rag_pipeline import retrieve_context

# ── LLM setup ────────────────────────────────────────────────────────────────
llm = ChatGroq(
    model="llama3-70b-8192",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.3,
)

SYSTEM_PROMPT = """You are Roadmapify, an expert learning coach and curriculum designer.
Using the retrieved knowledge provided, generate a structured, personalized learning roadmap.

Retrieved Knowledge:
{context}

Rules:
- Output ONLY a valid JSON object with no markdown, no code fences, no extra text.
- The JSON must match this exact schema.
- Resources must include real, working URLs (YouTube, MDN, freeCodeCamp, official docs, etc.)
- Each module must have 2-4 resources mixing video and reading.
- Practice questions must be specific and testable.
- Timeline must be realistic based on user availability.

JSON Schema:
{{
  "goal": "string",
  "domain": "string",
  "totalWeeks": number,
  "architecture": {{
    "recommended": "string",
    "reason": "string"
  }},
  "timeline": {{
    "hoursPerWeek": number,
    "startDate": "YYYY-MM-DD",
    "milestoneWeeks": [number]
  }},
  "modules": [
    {{
      "id": number,
      "title": "string",
      "week": number,
      "estimatedHours": number,
      "description": "string",
      "tasks": ["string"],
      "resources": [
        {{
          "title": "string",
          "type": "video|article|documentation|book|platform",
          "url": "string",
          "duration": "string"
        }}
      ],
      "checkpoint": {{
        "practiceQuestions": ["string"],
        "miniProject": "string"
      }}
    }}
  ],
  "milestones": [
    {{
      "week": number,
      "title": "string",
      "description": "string"
    }}
  ]
}}"""

USER_PROMPT = """Generate a complete learning roadmap for this request:

Goal: {goal}
Domain: {domain}
Current Level: {level}
Hours per week available: {hours_per_week}
Preferred learning style: {learning_style}
Additional context: {context_extra}

Generate 6-10 modules. Make resources specific with real URLs."""


def generate_roadmap(
    goal: str,
    domain: str = "general",
    level: str = "beginner",
    hours_per_week: int = 10,
    learning_style: str = "mixed",
    context_extra: str = "",
) -> dict:
    """
    Main entry point. Retrieves RAG context then calls Groq to generate roadmap.
    Returns parsed JSON dict.
    """
    # Retrieve relevant context from ChromaDB
    try:
        context_docs = retrieve_context(f"{goal} {domain} {level}", n_results=8)
        context_text = "\n\n".join(
            f"[Source: {d.get('source', 'unknown')}] {d.get('content', d.get('text', ''))}"
            for d in context_docs
        ) if context_docs else "No specific context retrieved. Use general knowledge."
    except Exception as e:
        print(f"[RAG] Context retrieval failed (non-fatal): {e}")
        context_text = "Use general knowledge to generate a comprehensive roadmap."

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", USER_PROMPT),
    ])

    chain = prompt | llm

    response = chain.invoke({
        "context": context_text,
        "goal": goal,
        "domain": domain,
        "level": level,
        "hours_per_week": hours_per_week,
        "learning_style": learning_style,
        "context_extra": context_extra,
    })

    raw = response.content.strip()

    # Strip any accidental markdown fences
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        # Try to extract JSON object from response
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"LLM returned non-JSON response: {e}\nRaw: {raw[:500]}")


def chat_with_roadmap(
    user_message: str,
    roadmap_context: dict,
    current_module: dict | None,
    current_resource: dict | None,
    chat_history: list[dict],
) -> str:
    """
    Context-aware chatbot that knows which module/resource the user is on.
    Returns a plain string response.
    """
    module_ctx = ""
    if current_module:
        module_ctx = f"""
The user is currently working on:
Module: {current_module.get('title', 'Unknown')}
Module Description: {current_module.get('description', '')}
Module Tasks: {', '.join(current_module.get('tasks', []))}
"""
    resource_ctx = ""
    if current_resource:
        resource_ctx = f"""
They are currently using this resource:
Resource: {current_resource.get('title', 'Unknown')}
Type: {current_resource.get('type', 'unknown')}
URL: {current_resource.get('url', '')}
"""

    system = f"""You are Roadmapify's AI tutor — an expert, friendly learning assistant.
You have full context about the user's learning roadmap and exactly where they are in it.

Their overall goal: {roadmap_context.get('goal', 'learning')}
Their domain: {roadmap_context.get('domain', 'general')}
{module_ctx}
{resource_ctx}

Guidelines:
- Explain concepts specifically in the context of their current module and resource.
- Use analogies, examples, and step-by-step breakdowns.
- If they ask about code, provide working code examples.
- If they're confused, break it down further.
- Keep answers concise but complete.
- Offer to go deeper or give a quick summary based on their question.
"""

    messages = [("system", system)]
    for msg in chat_history[-10:]:  # Keep last 10 turns
        messages.append((msg["role"], msg["content"]))
    messages.append(("human", user_message))

    prompt = ChatPromptTemplate.from_messages(messages)
    chain = prompt | llm
    response = chain.invoke({})
    return response.content.strip()


if __name__ == "__main__":
    # Quick test
    result = generate_roadmap(
        goal="Build and deploy a full-stack web application",
        domain="web development",
        level="intermediate",
        hours_per_week=15,
    )
    print(json.dumps(result, indent=2))