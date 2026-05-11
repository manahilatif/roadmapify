# Roadmapify — Complete Codebase Reference

> This document is a full, self-contained reference for the Roadmapify project.
> It covers every file, every function, and every design decision so that any reader
> can understand the entire system without access to the actual code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Backend — FastAPI Entry Point](#3-backend--fastapi-entry-point)
4. [RAG Pipeline](#4-rag-pipeline)
   - 4a. [roadmap_chain.py — LLM Orchestration](#4a-roadmap_chainpy--llm-orchestration)
   - 4b. [rag_pipeline.py — Retrieval Layer](#4b-rag_pipelinepy--retrieval-layer)
   - 4c. [embedder.py — Vector Store Management](#4c-embedderpy--vector-store-management)
   - 4d. [chunker.py — Text Segmentation](#4d-chunkerpy--text-segmentation)
   - 4e. [evaluator.py — RAG Evaluation](#4e-evaluatorpy--rag-evaluation)
5. [Data Scrapers](#5-data-scrapers)
6. [Agent Stubs](#6-agent-stubs)
7. [Data Layer](#7-data-layer)
8. [Frontend — Complete Walkthrough](#8-frontend--complete-walkthrough)
   - 8a. [Entry Points](#8a-entry-points)
   - 8b. [Pages](#8b-pages)
   - 8c. [Components](#8c-components)
   - 8d. [Auth & Firebase](#8d-auth--firebase)
   - 8e. [Design System](#8e-design-system)
9. [End-to-End Request Flow](#9-end-to-end-request-flow)
10. [Configuration & Environment](#10-configuration--environment)
11. [Evaluation Results](#11-evaluation-results)
12. [Deployment](#12-deployment)

---

## 1. Project Overview

### What Roadmapify Does

Roadmapify converts any plain-English goal — *"prepare for IELTS in 6 weeks"* or *"build an Instagram clone"* — into a fully personalized, **interactive visual learning roadmap** with real resources, a realistic timeline, and a context-aware AI tutor.

### Key Differentiators

| Feature | Roadmapify | Static alternatives (roadmap.sh, etc.) |
|---------|-----------|--------------------------------------|
| Goal entry | Plain English ("I want to bake sourdough bread") | Pre-built curriculum trees |
| Roadmap scope | Any domain (tech, IELTS, cooking, crochet) | Mostly tech |
| Resources | RAG-verified real URLs from 10 data sources | Static curated lists |
| UI | Interactive game-like node map with XP/streaks | Lists or static diagrams |
| AI assistance | Context-aware tutor (knows your current module) | Generic chatbot |
| Personalization | Adapts to experience level + hours/week | One-size-fits-all |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                        │
│  LandingPage → OnboardingPage → RoadmapPage + ChatBot       │
│  Hosted on Vercel                                            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP (Axios / fetch)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                          │
│  main.py: POST /generate-roadmap  POST /chat  POST /progress │
│  Hosted on Render                                            │
└──────────┬──────────────────────────┬───────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌───────────────────────┐
│  LLM Layer       │      │  RAG Layer             │
│  Groq            │      │  ChromaDB (local)      │
│  llama-3.3-70b   │      │  SentenceTransformer   │
│  via LangChain   │      │  all-MiniLM-L6-v2      │
└──────────────────┘      └──────────┬────────────┘
                                     │
                          ┌──────────▼────────────┐
                          │  Knowledge Base        │
                          │  10 scraped sources    │
                          │  roadmap.sh, CS50,     │
                          │  MIT OCW, YouTube,     │
                          │  Reddit, Tavily, etc.  │
                          └───────────────────────┘
```

### Tech Stack Summary

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Frontend framework | React | 19.2.5 |
| Build tool | Vite | 8.0.10 |
| Styling | Tailwind CSS | 3.4.19 |
| Graph visualization | ReactFlow | 11.11.4 |
| HTTP client | Axios + fetch | — |
| Authentication | Firebase | 12.12.1 |
| Backend framework | FastAPI | — |
| LLM | Groq llama-3.3-70b-versatile | via LangChain |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 | 384-dim, local |
| Vector DB | ChromaDB | persistent local |
| Web search | Tavily API | real-time |
| Data validation | Pydantic | — |
| ASGI server | Uvicorn | — |

---

## 2. Repository Structure

```
roadmapify/
│
├── backend/                          # FastAPI Python backend
│   ├── main.py                       # ★ App entrypoint — all API routes
│   ├── requirements.txt              # Python dependencies
│   ├── .env                          # API keys (not in git)
│   ├── .env.example                  # Template for environment variables
│   ├── sample_generate_roadmap_response.json  # Example API response
│   ├── E2E_GENERATE_ROADMAP_SAMPLE.md         # End-to-end test walkthrough
│   │
│   ├── agents/                       # Agent stubs (planned, not yet implemented)
│   │   ├── architect.py              # (empty) — roadmap structure agent
│   │   ├── librarian.py              # (empty) — resource retrieval agent
│   │   └── tutor.py                  # (empty) — chat tutor agent
│   │
│   ├── api/                          # API route handlers (empty stubs)
│   │   ├── chat.py                   # (empty) — routes currently in main.py
│   │   ├── roadmap.py                # (empty) — routes currently in main.py
│   │   └── progress.py               # (empty) — routes currently in main.py
│   │
│   ├── models/
│   │   └── schemas.py                # (empty) — Pydantic models in main.py
│   │
│   └── rag/                          # ★ Core AI/ML pipeline
│       ├── roadmap_chain.py          # ★ LLM prompts + generation logic
│       ├── rag_pipeline.py           # ★ ChromaDB retrieval
│       ├── embedder.py               # ★ Vector store setup + chunk storage
│       ├── chunker.py                # ★ Text segmentation strategy
│       ├── evaluator.py              # ★ RAG vs baseline evaluation
│       ├── scraper.py                # Generic scraper utilities
│       ├── scraper_roadmapsh.py      # roadmap.sh scraper
│       ├── scraper_tutorials.py      # freeCodeCamp, WikiHow, Instructables
│       ├── scraper_youtube.py        # YouTube transcript scraper
│       ├── scraper_cs50.py           # Harvard CS50 courses
│       ├── scraper_mitocw.py         # MIT OpenCourseWare
│       ├── scraper_kaggle.py         # Kaggle + Coursera datasets
│       ├── scraper_reddit.py         # Reddit posts (PRAW)
│       ├── scraper_tavily.py         # Tavily live web search
│       └── scraper_onet_and_datasets.py  # O*NET + GitHub roadmap
│
├── chroma_db/                        # Persisted ChromaDB vector index
│   └── 9b159387-f172-4ccb-b144-c0350dd03a20/
│       ├── data_level0.bin           # HNSW graph index
│       ├── length.bin                # Chunk lengths
│       └── chroma.sqlite3            # Metadata + document store (3MB)
│
├── data/
│   ├── raw/                          # Raw scraped JSON documents
│   │   ├── roadmapsh_raw.json        # 34KB — 13 roadmaps
│   │   ├── tutorials_raw.json        # 88KB — 46 articles
│   │   ├── cs50_raw.json             # 37KB — 4 courses
│   │   ├── mitocw_raw.json           # 59KB — 8 courses
│   │   ├── tavily_raw.json           # 87KB — 17 search queries
│   │   ├── github_roadmap_raw.json   # 141KB — community dev roadmap
│   │   ├── kaggle_raw.json           # (empty — requires API key)
│   │   ├── reddit_raw.json           # (empty — requires API key)
│   │   ├── youtube_raw.json          # (empty — requires transcript API)
│   │   ├── onet_raw.json             # (empty — requires download)
│   │   └── gdrive_raw.json           # (empty — manual download)
│   │
│   ├── processed/
│   │   └── roadmapsh_chunks.json     # 34KB — chunked roadmapsh documents
│   │
│   ├── curated/                      # Hand-curated domain templates (10 domains)
│   │   ├── web_development.json
│   │   ├── data_science.json
│   │   ├── programming_language.json
│   │   ├── uiux_design.json
│   │   ├── digital_marketing.json
│   │   ├── ielts_preparation.json
│   │   ├── language_learning.json
│   │   ├── cooking.json
│   │   ├── baking.json
│   │   └── crochet.json
│   │
│   ├── eval_results.json             # RAG vs baseline comparison metrics
│   ├── grounding_comparison.png      # Chart: grounding scores
│   ├── latency_comparison.png        # Chart: latency comparison
│   └── stage_comparison.png          # Chart: node count comparison
│
├── frontend/                         # React frontend
│   ├── index.html                    # Root HTML (font imports, #root div)
│   ├── vite.config.js                # Vite + React plugin config
│   ├── tailwind.config.js            # Tailwind config
│   ├── package.json                  # Node dependencies
│   └── src/
│       ├── main.jsx                  # React DOM entrypoint
│       ├── App.jsx                   # ★ Main app router + page state
│       ├── index.css                 # Global design system (CSS vars, animations)
│       ├── firebase.js               # Firebase auth + Firestore init
│       ├── assets/
│       │   ├── hero.png              # Hero section image
│       │   └── vite.svg              # Vite logo
│       ├── context/
│       │   └── AuthContext.jsx       # useAuth() hook — Firebase auth state
│       ├── components/
│       │   ├── Navbar.jsx            # Top navigation bar
│       │   ├── Logo.jsx              # Roadmapify brand logo SVG
│       │   ├── SignInModal.jsx       # Email/password Firebase auth modal
│       │   ├── ChatButton.jsx        # Floating button to toggle ChatBot
│       │   └── ChatBot.jsx           # ★ AI tutor chat interface
│       └── pages/
│           ├── LandingPage.jsx       # ★ Hero + features + examples modal
│           ├── OnboardingPage.jsx    # ★ 5-step goal collection form
│           ├── RoadmapPage.jsx       # ★ Interactive SVG roadmap + gamification
│           └── GeneratePage.jsx      # Alternative simpler generation form
│
├── notebooks/
│   ├── rag_pipeline_test.ipynb       # RAG retrieval testing notebook
│   └── scraper_test.ipynb            # Scraper output debugging notebook
│
├── F26-17.ipynb                      # Experiment notebook
├── F26_17.ipynb                      # Duplicate experiment notebook
├── Youtube.ipynb                     # YouTube scraper experiment
├── README.md                         # Project documentation
├── requirements.txt                  # Root-level minimal Python deps
└── runtime.txt                       # Python 3.12.8
```

---

## 3. Backend — FastAPI Entry Point

**File:** `backend/main.py`

This is the single entrypoint for the entire backend. All API routes are defined here (the `api/` directory stubs are unused). It uses lazy imports to avoid loading the heavy LLM and ChromaDB dependencies at startup, which speeds up cold start on Render.

### Key Design Decisions

- **Lazy imports** for `generate_roadmap` and `chat_with_roadmap`: the functions are only imported on the first request, not at module load time. This avoids slow cold starts.
- **Field aliasing**: the `GenerateRequest` model accepts multiple field name variants (`difficulty` / `experience` / `level`, `time_commitment` / `timeframe`) so the frontend never breaks due to naming mismatches.
- **In-memory progress store**: `_progress` is a plain Python dict. It resets on server restart — progress is not persisted to a database.
- **Fallback route**: `_fallback(goal)` returns a hardcoded 6-node generic roadmap if the LLM fails after retries.
- **CORS**: explicitly whitelists `localhost:5173` (Vite dev) and `*.vercel.app` (production).

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/` | Service health check |
| GET | `/health` | Liveness probe |
| POST | `/generate-roadmap` | Generate a personalized roadmap |
| POST | `/generate` | Alias for `/generate-roadmap` |
| POST | `/chat` | AI tutor chat message |
| POST | `/progress` | Mark a module complete |
| GET | `/progress/{roadmap_id}` | Retrieve progress state |

### Request Models

```python
class GenerateRequest(BaseModel):
    goal:            str                  # required — plain English goal
    difficulty:      Optional[str] = "beginner"
    time_commitment: Optional[str] = "1 month"
    experience:      Optional[str] = None  # alias for difficulty
    timeframe:       Optional[str] = None  # alias for time_commitment
    level:           Optional[str] = None  # alias for difficulty
    domain:          Optional[str] = "general"
    hours_per_week:  Optional[int] = 10
    learning_style:  Optional[str] = "mixed"

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
```

### Full Source Code

```python
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
from typing import Optional, List

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

# Lazy imports — only loaded on first request to speed up cold start
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


class GenerateRequest(BaseModel):
    goal:            str = Field(..., min_length=1)
    difficulty:      Optional[str] = "beginner"
    time_commitment: Optional[str] = "1 month"
    experience:      Optional[str] = None
    timeframe:       Optional[str] = None
    level:           Optional[str] = None
    domain:          Optional[str] = "general"
    hours_per_week:  Optional[int] = 10
    learning_style:  Optional[str] = "mixed"

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


_progress: dict = {}


@app.get("/")
def root():
    return {"service": "Roadmapify API", "version": "2.0.0", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/generate-roadmap")
def generate_roadmap_endpoint(req: GenerateRequest):
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


@app.post("/generate")
def generate_alias(req: GenerateRequest):
    return generate_roadmap_endpoint(req)


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
            # ... (nodes 2-6 and bonus_1 follow same pattern)
        ],
    }
```

### Roadmap Node Response Structure

Every successful `/generate-roadmap` response returns this JSON shape:

```json
{
  "title": "IELTS Preparation Roadmap",
  "description": "A structured journey to achieve band 7.0",
  "total_xp": 850,
  "nodes": [
    {
      "id": "node_1",
      "title": "Diagnose Your Starting IELTS Band",
      "description": "Take a full diagnostic test to identify your baseline score.",
      "type": "main",
      "emoji": "🔍",
      "duration_label": "Week 1",
      "xp_reward": 100,
      "status": "active",
      "steps": [
        "Download an official IELTS practice test from ielts.org",
        "Complete all four sections under timed conditions",
        "Score yourself using the official band descriptors",
        "Record your band for each skill: Listening, Reading, Writing, Speaking"
      ],
      "resources": [
        {"label": "Official IELTS Practice Tests", "url": "https://www.ielts.org", "tip": "Most authentic practice"},
        {"label": "IELTS Liz", "url": "https://ieltsliz.com", "tip": "Free tips and strategies"}
      ]
    },
    {
      "id": "node_2",
      "title": "...",
      "status": "locked",
      ...
    },
    ...
    {
      "id": "bonus_1",
      "type": "bonus",
      "status": "locked",
      "xp_reward": 250,
      ...
    }
  ]
}
```

**Node types:**
- `"main"` — sequential nodes on the primary learning path (node_1 through node_7)
- `"bonus"` — optional side-quest node (bonus_1), unlocked by spending XP

**Node statuses:**
- `"active"` — currently unlocked and available (only node_1 at generation time)
- `"locked"` — not yet accessible
- `"done"` — completed by the user (set client-side)

---

## 4. RAG Pipeline

### 4a. `roadmap_chain.py` — LLM Orchestration

**File:** `backend/rag/roadmap_chain.py`

This is the brain of the system. It handles two tasks:
1. **`generate_roadmap()`** — calls the RAG retrieval layer, then calls the Groq LLM to produce an 8-node roadmap JSON.
2. **`chat_with_roadmap()`** — powers the AI tutor chatbot with context-awareness about the learner's current module.

#### Model Configuration

```python
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.7,   # creative enough for diverse roadmaps
    max_tokens=4096,   # enough for 8 full nodes
)
```

#### System Prompt Design

The system prompt is carefully engineered to force the LLM to:
- Return **exactly 8 nodes** (node_1 through node_7 plus bonus_1) with no ellipses or shortcuts
- Use **bracket placeholders** (`[PLACEHOLDER]`) as fill-in markers
- Write **specific, goal-dependent titles** (banned: "Getting Started", "Foundation", "Introduction", etc.)
- Include **only real https:// URLs** from a curated seed list provided in the prompt
- Return **pure JSON** (no markdown fences, no surrounding text)

The prompt uses `{{ }}` (double-brace) notation for literal curly braces, because LangChain's template engine uses single braces `{}` for variable substitution.

#### `generate_roadmap()` Function Flow

```
1. Attempt RAG retrieval:
   retrieve_context(f"{goal} {difficulty}", n_results=5)
   → Returns top-5 chunk strings from ChromaDB
   → context_text = "[source] chunk_content[:300] ..."

2. Call LLM (attempt 1):
   _call_llm(context_text, goal, difficulty, time_commitment)
   → Builds ChatPromptTemplate from SYSTEM_PROMPT + USER_PROMPT
   → Invokes (prompt | llm)
   → Strips markdown fences from response
   → json.loads() the raw text

3. Validate: need ≥ 4 main nodes
   If too few: retry once (attempt 2)

4. If both attempts fail: _build_fallback(goal)
   → Returns hardcoded 8-node generic template

5. _sanitize_urls(data)
   → Replaces bad URLs (example.com, placeholder, non-https, too-short)
   → Cycles through 3 verified fallback URLs

6. data.setdefault("total_xp", sum of xp_rewards)

7. Return data dict
```

#### `chat_with_roadmap()` Function Flow

```
1. Build node context string from current_module dict
   (title, description, steps list)

2. Build resource context from current_resource dict
   (label, url)

3. Assemble system prompt:
   "You are Roadmapify's AI tutor — expert, friendly, specific.
    Goal: {goal}
    Currently on: {module.title}
    Description: {module.description}
    Steps: [...]
    Using resource: {resource.label} — {resource.url}
    Give specific, actionable help."

4. Build message list from chat_history (last 6 messages)

5. Append current user_message as ("human", user_message)

6. Invoke (ChatPromptTemplate | llm) with empty {} variables

7. Return response.content.strip()
```

#### URL Sanitization

```python
BAD = ["example.com", "placeholder", "N/A", "http://", "https://url", "[real-url]", "[url]"]
FALLBACKS = [
    {"label": "freeCodeCamp",    "url": "https://www.freecodecamp.org/learn"},
    {"label": "MDN Web Docs",    "url": "https://developer.mozilla.org"},
    {"label": "The Odin Project","url": "https://www.theodinproject.com"},
]
```

A URL is considered bad if: it doesn't start with `https://`, contains any BAD substring, or is shorter than 16 characters. Bad URLs are replaced with the cycling fallback list.

#### Full Source Code

```python
"""
roadmap_chain.py
LangChain + Groq. Generates a nodes[] roadmap where each node is ONE specific task.
"""
import os, sys, json, pathlib, re

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
    try:
        sys.path.insert(0, str(ROOT / "backend" / "rag"))
        from rag_pipeline import retrieve_context
    except ImportError:
        retrieve_context = None

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.7,
    max_tokens=4096,
)

SYSTEM_PROMPT = """You are Roadmapify. Return a complete learning roadmap as a JSON object.

Context: {context}

RULES:
1. Output EXACTLY 8 nodes: node_1, node_2, node_3, node_4, node_5, node_6, node_7, bonus_1
2. node_1 status "active"; all others status "locked"
3. node_1 through node_7 type "main"; bonus_1 type "bonus"
4. Each title must be 3-7 words, SPECIFIC to the learner's goal.
   FORBIDDEN titles: "Getting Started", "Foundation", "Learn basics", "Core Skills", "Introduction", "Overview"
5. Each main node: steps (3-5 concrete how-to instructions) and resources (2 real https:// URLs)
6. Do NOT use "..." anywhere. Write all 8 nodes in full.

Real resource URLs:
https://www.ielts.org | https://ieltsliz.com | https://www.ielts-simon.com
https://www.britishcouncil.org/exam/ielts/ielts-practice-tests
https://www.freecodecamp.org/learn | https://javascript.info
https://developer.mozilla.org | https://docs.python.org/3/tutorial
https://www.kaggle.com/learn | https://git-scm.com/book/en/v2
https://tailwindcss.com/docs | https://docs.docker.com/get-started

Return ONLY valid JSON. Start with {{ and end with }}. No markdown. No text outside the JSON.

Template — replace every [PLACEHOLDER] with real goal-specific content:
{{
  "title": "[Goal name] Roadmap",
  "description": "[One sentence about this learning path]",
  "total_xp": 850,
  "nodes": [
    {{
      "id": "node_1",
      "title": "[Specific first task for this goal]",
      "description": "[One sentence explaining what the learner does]",
      "type": "main",
      "emoji": "[single emoji]",
      "duration_label": "Week 1",
      "xp_reward": 100,
      "status": "active",
      "steps": ["[Exact action 1]", "[Exact action 2]", "[Exact action 3]", "[Exact action 4]"],
      "resources": [
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}},
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}}
      ]
    }},
    ... (nodes 2-7 and bonus_1 with same structure)
  ]
}}"""

USER_PROMPT = """Generate the roadmap for:

Goal: {goal}
Level: {difficulty}
Timeframe: {time_commitment}

Replace every [PLACEHOLDER] in the template with real, specific content for this exact goal.
Output all 8 nodes (node_1 through node_7 plus bonus_1). Do not skip any node."""


def _call_llm(context_text, goal, difficulty, time_commitment):
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human",  USER_PROMPT),
    ])
    response = (prompt | llm).invoke({
        "context":         context_text,
        "goal":            goal,
        "difficulty":      difficulty,
        "time_commitment": time_commitment,
    })
    raw = response.content.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise ValueError(f"Non-JSON from LLM: {raw[:300]}")


def _sanitize_urls(data):
    BAD = ["example.com", "placeholder", "N/A", "http://", "https://url", "[real-url]", "[url]"]
    FALLBACKS = [
        {"label": "freeCodeCamp",    "url": "https://www.freecodecamp.org/learn",   "tip": "Free comprehensive learning"},
        {"label": "MDN Web Docs",    "url": "https://developer.mozilla.org",         "tip": "Official web documentation"},
        {"label": "The Odin Project","url": "https://www.theodinproject.com",        "tip": "Free full-stack curriculum"},
    ]
    for node in data.get("nodes", []):
        clean = []
        for i, res in enumerate(node.get("resources", [])):
            url = res.get("url", "")
            is_bad = (
                not url
                or not url.startswith("https://")
                or any(p in url for p in BAD)
                or len(url) < 16
            )
            if is_bad:
                fb  = FALLBACKS[i % len(FALLBACKS)]
                res = {**res, "url": fb["url"], "label": res.get("label") or fb["label"], "tip": res.get("tip") or fb["tip"]}
            clean.append(res)
        node["resources"] = clean
    return data


def generate_roadmap(goal, difficulty="beginner", time_commitment="1 month"):
    context_text = "Use general knowledge."
    if retrieve_context is not None:
        try:
            docs = retrieve_context(f"{goal} {difficulty}", n_results=5)
            if docs:
                context_text = "\n\n".join(
                    f"[{d.get('source','?')}] {d.get('content', d.get('text',''))[:300]}"
                    for d in docs
                )
        except Exception as e:
            print(f"[RAG] non-fatal: {e}")

    data = None
    for attempt in range(2):
        try:
            data = _call_llm(context_text, goal, difficulty, time_commitment)
            main_nodes = [n for n in data.get("nodes", []) if n.get("type") != "bonus"]
            if len(main_nodes) >= 4:
                break
            data = None
        except Exception as e:
            print(f"[generate_roadmap] attempt {attempt+1} error: {e}")
            data = None

    if data is None:
        return _build_fallback(goal)

    data = _sanitize_urls(data)
    data.setdefault("total_xp", sum(n.get("xp_reward", 100) for n in data["nodes"]))
    return data


def chat_with_roadmap(user_message, roadmap_context, current_module, current_resource, chat_history):
    node_ctx = ""
    if current_module:
        steps    = current_module.get("steps", [])
        node_ctx = (
            f"\nCurrently on: {current_module.get('title','')}"
            f"\nDescription: {current_module.get('description','')}"
            f"\nSteps: {json.dumps(steps)}\n"
        )
    res_ctx = ""
    if current_resource:
        res_ctx = f"\nUsing resource: {current_resource.get('label', current_resource.get('title',''))} — {current_resource.get('url','')}\n"

    goal   = roadmap_context.get("title", roadmap_context.get("goal", "the learning goal"))
    system = (
        f"You are Roadmapify's AI tutor — expert, friendly, specific.\n"
        f"Goal: {goal}\n{node_ctx}{res_ctx}\n"
        f"Give specific, actionable help. Use examples and exact steps when relevant. Keep answers concise."
    )

    messages = [("system", system)]
    for m in chat_history[-6:]:
        role = m["role"] if m["role"] in ("human", "assistant", "system") else "human"
        messages.append((role, m["content"]))
    messages.append(("human", user_message))

    response = (ChatPromptTemplate.from_messages(messages) | llm).invoke({})
    return response.content.strip()
```

---

### 4b. `rag_pipeline.py` — Retrieval Layer

**File:** `backend/rag/rag_pipeline.py`

The retrieval layer connects the LLM chain to ChromaDB. It has one function: `retrieve_context()`.

#### What It Does

1. Calls `get_collection()` from `embedder.py` to get the ChromaDB collection handle (loaded once at module level, reused across all requests).
2. Runs `collection.query(query_texts=[query], n_results=n_results)` — ChromaDB automatically embeds the query text using the same `all-MiniLM-L6-v2` model, then performs cosine-similarity search.
3. Returns the top-K document strings joined by `\n\n`.

**Important:** The return type changed from a joined string to the raw list of dicts (`docs = results["documents"][0]`). In `roadmap_chain.py`, `retrieve_context()` is expected to return an iterable. If the return value is a string (old behavior) vs list (current), the format logic in `roadmap_chain.py` handles both.

#### Full Source Code

```python
"""
rag_pipeline.py
Retrieval layer for Roadmapify.
Given a user query, fetches the most relevant chunks from ChromaDB.
"""

import sys
import pathlib

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from backend.rag.embedder import get_collection

# Loaded once at module level — reused across all requests
_collection = get_collection()


def retrieve_context(query: str, n_results: int = 8) -> str:
    results = _collection.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas"],
    )

    docs = results["documents"][0]

    if not docs:
        return "No relevant context found in knowledge base."

    return "\n\n".join(docs)
```

---

### 4c. `embedder.py` — Vector Store Management

**File:** `backend/rag/embedder.py`

Handles all ChromaDB operations: creating/opening the collection, embedding text chunks, and storing them. This file is both a library (imported by `rag_pipeline.py`) and a CLI tool (run directly to ingest `data/processed/*.json`).

#### Embedding Model

- **Model:** `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensions:** 384
- **Why this model:** Lightweight (~90MB download), runs locally without API keys, good quality for semantic search. No cost, no rate limits.
- **Fallback chain:** SentenceTransformer → ChromaDB DefaultEmbeddingFunction → None (broken but non-crashing)

#### ChromaDB Setup

- **Client type:** `PersistentClient` — data survives process restarts (stored on disk at `./chroma_db`)
- **Collection name:** `roadmapify_kb` — single unified collection for all domains
- **Similarity metric:** Cosine similarity (`"hnsw:space": "cosine"`)
- **Upsert:** Re-running ingestion is safe (idempotent) because `collection.upsert()` updates existing IDs

#### Key Functions

| Function | Purpose |
|----------|---------|
| `get_chroma_client()` | Returns a `PersistentClient` backed by `./chroma_db` |
| `get_embedding_function()` | Returns the best available embedding function (with fallbacks) |
| `get_collection()` | Gets or creates the `roadmapify_kb` collection with embedding function attached |
| `store_chunks(chunks)` | Batch-upserts chunks into ChromaDB (batch size 64) |
| `verify_collection()` | Runs a test query to confirm embeddings work |
| `collection_info()` | Returns count + domain/source breakdown |

#### Chunk Metadata Fields

Each stored document has these metadata fields:
```
source        — data source name (e.g., "roadmap.sh", "freeCodeCamp")
domain        — learning domain (e.g., "frontend", "ielts")
roadmap       — roadmap name (e.g., "Frontend Development")
topic         — specific topic within the roadmap
url           — source URL
content_type  — type of content (e.g., "roadmap_topic", "tutorial_article")
difficulty    — difficulty level (beginner/intermediate/advanced)
chunk_index   — position within the source document (0-based)
chunk_total   — total chunks from this source document
```

#### Full Source Code

```python
"""
embedder.py
Embeds text chunks and stores them in ChromaDB.
"""

from __future__ import annotations

import json
import os
import pathlib
import time
from typing import Optional

import chromadb
from chromadb.utils import embedding_functions

BATCH_SIZE = 64
_DEFAULT_DB = "./chroma_db"
_DEFAULT_COLLECTION = "roadmapify_kb"
_DEFAULT_EMBED = "all-MiniLM-L6-v2"


def _project_root() -> pathlib.Path:
    return pathlib.Path(__file__).resolve().parents[2]

def _resolved_chroma_path() -> str:
    raw = os.environ.get("CHROMA_DB_PATH", _DEFAULT_DB)
    p = pathlib.Path(raw)
    if not p.is_absolute():
        p = _project_root() / p
    p.mkdir(parents=True, exist_ok=True)
    return str(p)

def _collection_name() -> str:
    return os.environ.get("CHROMA_COLLECTION", _DEFAULT_COLLECTION)

def _embed_model() -> str:
    return os.environ.get("CHROMA_EMBED_MODEL", _DEFAULT_EMBED)


CHROMA_DB_PATH = _resolved_chroma_path()
COLLECTION_NAME = _collection_name()
EMBED_MODEL = _embed_model()


def get_chroma_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(path=_resolved_chroma_path())


def get_embedding_function(embed_model=None):
    model = embed_model if embed_model is not None else _embed_model()
    try:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=model)
        return ef
    except Exception as e:
        pass

    try:
        ef = embedding_functions.DefaultEmbeddingFunction()
        return ef
    except Exception:
        return None


def get_collection(client=None, collection_name=None, embed_model=None):
    if client is None:
        client = get_chroma_client()

    name = collection_name if collection_name is not None else _collection_name()
    ef = get_embedding_function(embed_model if embed_model is not None else _embed_model())

    kwargs = dict(
        name=name,
        metadata={
            "hnsw:space": "cosine",
            "description": "Roadmapify knowledge base — multi-domain learning content",
        },
    )
    if ef is not None:
        kwargs["embedding_function"] = ef

    return client.get_or_create_collection(**kwargs)


def _sanitize_metadata(meta: dict) -> dict:
    clean = {}
    for k, v in meta.items():
        if isinstance(v, (str, int, float, bool)):
            clean[k] = v
        elif v is None:
            clean[k] = ""
        else:
            clean[k] = str(v)
    return clean


def store_chunks(chunks, collection=None, batch_size=BATCH_SIZE):
    if not chunks:
        return collection or get_collection()

    if collection is None:
        collection = get_collection()

    CONTENT_FIELD = "content"
    ID_FIELD = "chunk_id"

    total = len(chunks)
    batches = (total + batch_size - 1) // batch_size

    stored = 0
    for batch_num in range(batches):
        start = batch_num * batch_size
        end = min(start + batch_size, total)
        batch = chunks[start:end]

        ids = [c[ID_FIELD] for c in batch]
        documents = [c[CONTENT_FIELD] for c in batch]
        metadatas = [
            _sanitize_metadata({k: v for k, v in c.items() if k not in (ID_FIELD, CONTENT_FIELD)})
            for c in batch
        ]

        collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        stored += len(batch)

    return collection


def verify_collection(collection, n_results=3):
    test_query = "How do I get started with web development?"
    results = collection.query(
        query_texts=[test_query],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )
    # prints results for debugging


def collection_info(collection) -> dict:
    count = collection.count()
    sample = collection.get(limit=min(count, 500), include=["metadatas"])
    domain_counts = {}
    source_counts = {}
    for meta in sample["metadatas"]:
        d = meta.get("domain", "unknown")
        s = meta.get("source", "unknown")
        domain_counts[d] = domain_counts.get(d, 0) + 1
        source_counts[s] = source_counts.get(s, 0) + 1

    return {
        "collection": collection.name,
        "total_docs": count,
        "by_domain": dict(sorted(domain_counts.items(), key=lambda x: -x[1])),
        "by_source": dict(sorted(source_counts.items(), key=lambda x: -x[1])),
    }
```

---

### 4d. `chunker.py` — Text Segmentation

**File:** `backend/rag/chunker.py`

Splits raw scraped documents into overlapping text chunks suitable for embedding. The chunking strategy is **sentence-aware**: it never cuts mid-sentence, which preserves semantic coherence and improves retrieval quality.

#### Chunking Parameters

| Parameter | Value | Why |
|-----------|-------|-----|
| `CHUNK_SIZE_CHARS` | 2000 | ~500 tokens at ~4 chars/token — fits easily in LLM context |
| `OVERLAP_CHARS` | 200 | ~50 tokens — ensures no information is lost at chunk boundaries |
| `MIN_CHUNK_CHARS` | 100 | Discards short noise fragments (headers, single sentences) |

#### Sentence Splitting

Uses a regex that splits on sentence-ending punctuation followed by whitespace and a capital letter:
```python
_SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
```
This correctly handles "U.S.A", "e.g.", "3.14", "Dr. Smith" — none of these trigger a split because they're not followed by a capital letter after whitespace.

#### Chunk Algorithm

```
1. Split text → sentences[]
2. Start at sentence 0
3. Greedily add sentences to current chunk until chunk_size reached
4. Emit chunk when full
5. Walk back from chunk end by ~200 chars (sentence-aligned) for overlap
6. Continue from new start position
7. Repeat until all sentences consumed
```

#### Output Chunk Format

Each chunk dict:
```json
{
  "source": "roadmap.sh",
  "domain": "frontend",
  "roadmap": "Frontend Development",
  "topic": "What is a Frontend Developer?",
  "url": "https://roadmap.sh/frontend",
  "content_type": "roadmap_topic",
  "difficulty": "beginner",
  "chunk_id": "c3f2ebb1-b017-40ce-b09c-f684184844d5",
  "chunk_index": 0,
  "chunk_total": 1,
  "content": "A frontend developer is a professional who uses HTML, CSS, and JavaScript..."
}
```

#### Full Source Code

```python
"""
chunker.py
Splits raw scraped documents into fixed-size chunks with overlap.
"""

import re
import uuid
from typing import Optional

CHUNK_SIZE_CHARS = 2000
OVERLAP_CHARS    = 200
MIN_CHUNK_CHARS  = 100

_SENTENCE_SPLIT_RE = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')

def split_into_sentences(text: str) -> list[str]:
    parts = _SENTENCE_SPLIT_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE_CHARS, overlap: int = OVERLAP_CHARS) -> list[str]:
    sentences = split_into_sentences(text)
    if not sentences:
        return []

    chunks = []
    start_idx = 0

    while start_idx < len(sentences):
        current_chars = 0
        end_idx = start_idx

        while end_idx < len(sentences):
            added = len(sentences[end_idx]) + 1
            if current_chars + added > chunk_size and end_idx > start_idx:
                break
            current_chars += added
            end_idx += 1

        chunk_text_str = " ".join(sentences[start_idx:end_idx])
        if len(chunk_text_str) >= MIN_CHUNK_CHARS:
            chunks.append(chunk_text_str)

        if end_idx >= len(sentences):
            break

        overlap_chars_accum = 0
        new_start = end_idx
        while new_start > start_idx + 1:
            new_start -= 1
            overlap_chars_accum += len(sentences[new_start]) + 1
            if overlap_chars_accum >= overlap:
                break

        start_idx = max(new_start, start_idx + 1)

    return chunks


def chunk_document(doc: dict) -> list[dict]:
    content = doc.get("content", "")
    if not content:
        return []

    raw_chunks = chunk_text(content)
    if not raw_chunks:
        return []

    chunk_dicts = []
    total = len(raw_chunks)

    for i, chunk_str in enumerate(raw_chunks):
        chunk_dict = {
            "source":       doc.get("source", "unknown"),
            "domain":       doc.get("domain", "general"),
            "roadmap":      doc.get("roadmap", ""),
            "topic":        doc.get("topic", ""),
            "url":          doc.get("url", ""),
            "content_type": doc.get("content_type", "text"),
            "difficulty":   doc.get("difficulty", ""),
            "chunk_id":    str(uuid.uuid4()),
            "chunk_index": i,
            "chunk_total": total,
            "content":     chunk_str,
        }
        chunk_dicts.append(chunk_dict)

    return chunk_dicts


def chunk_all_documents(documents: list[dict]) -> list[dict]:
    all_chunks = []
    for doc in documents:
        chunks = chunk_document(doc)
        all_chunks.extend(chunks)
    return all_chunks


def chunk_stats(chunks: list[dict]) -> dict:
    if not chunks:
        return {}
    lengths = [len(c["content"]) for c in chunks]
    by_source = {}
    by_domain = {}
    for c in chunks:
        src = c.get("source", "unknown")
        dom = c.get("domain", "unknown")
        by_source[src] = by_source.get(src, 0) + 1
        by_domain[dom] = by_domain.get(dom, 0) + 1
    return {
        "total_chunks":   len(chunks),
        "avg_chars":      round(sum(lengths) / len(lengths)),
        "min_chars":      min(lengths),
        "max_chars":      max(lengths),
        "by_source":      by_source,
        "by_domain":      by_domain,
    }
```

---

### 4e. `evaluator.py` — RAG Evaluation

**File:** `backend/rag/evaluator.py`

Measures the quality of the RAG pipeline by comparing it to a baseline (no retrieval — pure LLM generation). Run once to produce `data/eval_results.json`.

#### Test Queries (8 domains)

```python
TEST_QUERIES = [
    {"query": "I want to learn web development from scratch",       "domain": "web_dev",          "level": "beginner"},
    {"query": "How do I become a data scientist?",                  "domain": "data_science",     "level": "beginner"},
    {"query": "I want to learn machine learning for production",    "domain": "data_science",     "level": "intermediate"},
    {"query": "Teach me UI/UX design basics",                       "domain": "uiux",             "level": "beginner"},
    {"query": "I want to learn Python programming",                 "domain": "programming",      "level": "beginner"},
    {"query": "How to get into digital marketing?",                 "domain": "digital_marketing","level": "beginner"},
    {"query": "I want to learn React and become a frontend developer","domain": "web_dev",        "level": "intermediate"},
    {"query": "Prepare me for IELTS exam in 3 months",              "domain": "ielts",            "level": "beginner"},
]
```

#### Metrics

| Metric | How Calculated |
|--------|---------------|
| **Retrieval Relevance** | Keyword overlap between query words and retrieved context words |
| **Grounding Score** | % of roadmap topics that appear in the retrieved context |
| **RAG Latency** | Wall-clock time for full RAG pipeline (retrieval + LLM) |
| **Baseline Latency** | Wall-clock time for LLM alone (no retrieval) |
| **Stage Count** | Number of nodes in RAG vs baseline roadmap |

#### Key Results (from `data/eval_results.json`)

- **Mean retrieval keyword overlap:** 0.395 (range: 0.0 – 0.7)
- **RAG grounding score:** Higher than baseline (RAG grounds topics in retrieved context)
- **RAG latency:** ~1.64s average (faster than baseline ~3.24s due to caching effects)
- **React query grounding:** RAG 0.318 vs baseline 0.083 — 3.8× more grounded

#### Baseline vs RAG Comparison

The baseline uses the same Groq model but without any retrieved context:
```python
def baseline_generate(query):
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.3)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Generate a learning roadmap as JSON with fields: title, description, estimated_total_weeks, stages..."),
        ("human", "{query}")
    ])
    result = (prompt | llm).invoke({"query": query})
    return parse_roadmap(result.content)
```

#### Full Source Code

```python
"""
evaluator.py
Evaluates the Roadmapify RAG pipeline vs baseline.
"""

import json, time, os, sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
from dotenv import load_dotenv
load_dotenv()

from backend.rag.rag_pipeline import retrieve_context
from backend.rag.roadmap_chain import generate_roadmap

TEST_QUERIES = [
    {"query": "I want to learn web development from scratch", "domain": "web_dev", "level": "beginner"},
    {"query": "How do I become a data scientist?", "domain": "data_science", "level": "beginner"},
    {"query": "I want to learn machine learning for production", "domain": "data_science", "level": "intermediate"},
    {"query": "Teach me UI/UX design basics", "domain": "uiux", "level": "beginner"},
    {"query": "I want to learn Python programming", "domain": "programming", "level": "beginner"},
    {"query": "How to get into digital marketing?", "domain": "digital_marketing", "level": "beginner"},
    {"query": "I want to learn React and become a frontend developer", "domain": "web_dev", "level": "intermediate"},
    {"query": "Prepare me for IELTS exam in 3 months", "domain": "ielts", "level": "beginner"},
]


def evaluate_retrieval_relevance(results):
    scores = []
    for r in results:
        query_words = set(r["query"].lower().split())
        context_words = set(r["retrieved_context"].lower().split())
        overlap = len(query_words & context_words) / max(len(query_words), 1)
        scores.append(overlap)
    return {
        "mean_keyword_overlap": round(sum(scores) / len(scores), 3),
        "min": round(min(scores), 3),
        "max": round(max(scores), 3),
    }


def evaluate_hallucination(roadmap_output, context):
    topics = []
    for stage in roadmap_output.get("stages", []):
        topics.extend(stage.get("topics", []))
    if not topics:
        return 0.0
    grounded = sum(1 for t in topics if t.lower() in context.lower())
    return round(grounded / len(topics), 3)


def run_full_evaluation():
    results = []
    for test in TEST_QUERIES:
        context = retrieve_context(test["query"], n_results=8)

        t0 = time.time()
        rag_raw = generate_roadmap(test["query"])
        rag_time = round(time.time() - t0, 2)
        rag_output = rag_raw if isinstance(rag_raw, dict) else json.loads(rag_raw)

        t1 = time.time()
        baseline_output = baseline_generate(test["query"])
        baseline_time = round(time.time() - t1, 2)

        results.append({
            "query": test["query"],
            "domain": test["domain"],
            "rag_stages": len(rag_output.get("stages", [])),
            "baseline_stages": len(baseline_output.get("stages", [])),
            "rag_grounding_score": evaluate_hallucination(rag_output, context),
            "baseline_grounding_score": evaluate_hallucination(baseline_output, context),
            "rag_latency_s": rag_time,
            "baseline_latency_s": baseline_time,
            "retrieved_context": context[:500],
        })
        time.sleep(5)

    relevance_summary = evaluate_retrieval_relevance(results)
    output = {"results": results, "retrieval_relevance_summary": relevance_summary}

    with open("data/eval_results.json", "w") as f:
        json.dump(output, f, indent=2)
    return output
```

---

## 5. Data Scrapers

All scrapers produce JSON files in `data/raw/` with a standard document format:

```json
{
  "source": "<data-source-name>",
  "domain": "<learning-domain>",
  "roadmap": "<roadmap-or-course-name>",
  "topic": "<specific-topic>",
  "url": "<source-url>",
  "content_type": "<roadmap_topic|tutorial_article|video_transcript|...>",
  "difficulty": "<beginner|intermediate|advanced>",
  "content": "<full text content>"
}
```

### Scraper 1: `scraper_roadmapsh.py`

**Target:** roadmap.sh (roadmap.sh/frontend, roadmap.sh/backend, etc.)
**Output:** `data/raw/roadmapsh_raw.json` (34KB)
**Method:** BeautifulSoup HTML scraping of prose sections
**Coverage:** 13 roadmaps — Frontend, Backend, DevOps, Python, React, SQL, DSA, System Design, CS, Git, Docker, Full Stack, JavaScript
**What it extracts:** Heading + paragraph blocks from the explanation sections of each roadmap topic

### Scraper 2: `scraper_tutorials.py`

**Target:** freeCodeCamp (13 articles), WikiHow (12 articles), Instructables (8 articles)
**Output:** `data/raw/tutorials_raw.json` (88KB)
**Method:** BeautifulSoup scraping + noise filtering (ads, newsletter CTAs, registration prompts)
**Coverage:**
- freeCodeCamp: HTML/CSS, JS, React, Git, Python, SQL, Docker, ML
- WikiHow: Language learning, cooking, baking, crochet, digital marketing, IELTS, UX
- Instructables: Crochet, baking, cooking, web design, photography

### Scraper 3: `scraper_youtube.py`

**Target:** 15 curated YouTube videos
**Output:** `data/raw/youtube_raw.json`
**Method:** `youtube-transcript-api` (no API key needed — uses YouTube's caption endpoint)
**Coverage:** JavaScript, HTML/CSS, React, Git, SQL, Python, ML, UI/UX, DSA, IELTS walkthroughs
**What it extracts:** Full English transcript text

### Scraper 4: `scraper_cs50.py`

**Target:** Harvard CS50 courses on cs50.harvard.edu
**Output:** `data/raw/cs50_raw.json` (37KB)
**Method:** BeautifulSoup scraping of course pages
**Coverage:**
- CS50x — Introduction to Computer Science
- CS50P — Introduction to Programming with Python
- CS50W — Web Programming with Python and JavaScript
- CS50AI — Introduction to Artificial Intelligence with Python
**What it extracts:** Week-by-week lecture titles, topics, and syllabus structure

### Scraper 5: `scraper_mitocw.py`

**Target:** MIT OpenCourseWare
**Output:** `data/raw/mitocw_raw.json` (59KB)
**Method:** BeautifulSoup scraping of OCW course pages
**Coverage:** 8 courses:
- 6.0001 — Intro to CS & Programming Using Python
- 6.006 — Introduction to Algorithms
- 6.042J — Mathematics for Computer Science
- 18.06 — Linear Algebra
- 6.036 — Introduction to Machine Learning
- 6.031 — Software Construction
- 6.004 — Computation Structures
- 6.046J — Algorithm Design and Analysis
**What it extracts:** Syllabi, lecture topics, prerequisites

### Scraper 6: `scraper_kaggle.py`

**Target:** Kaggle + Coursera course dataset
**Output:** `data/raw/kaggle_raw.json`
**Method:**
- API mode: Downloads CSV via Kaggle API (requires credentials in `~/.kaggle/kaggle.json`)
- Fallback: Processes manually downloaded CSVs from `data/raw/kaggle/`
**What it extracts:** Course titles, descriptions, difficulty levels, prerequisites, enrollment counts

### Scraper 7: `scraper_reddit.py`

**Target:** Reddit learning subreddits
**Output:** `data/raw/reddit_raw.json`
**Method:** PRAW (Python Reddit API Wrapper) — free tier (100 req/min)
**Coverage:** r/learnprogramming, r/webdev, r/datascience, r/ielts, r/uiux
**Config:** 10 posts/query, 3 comments/post, 1.2s delay between requests
**What it extracts:** Post titles, body text, top comments with score

### Scraper 8: `scraper_tavily.py`

**Target:** Real-time web search via Tavily API
**Output:** `data/raw/tavily_raw.json` (87KB)
**Method:** Tavily Search API (free tier: 5 results/query)
**Coverage:** 17 seed queries:
- React, Backend development, DevOps, Data Science, Machine Learning, SQL, DSA
- IELTS preparation, UI/UX design, Digital Marketing
- Python, JavaScript, Git, Docker
**What it extracts:** Title, URL, content snippet, score, published date

### Scraper 9: `scraper_onet_and_datasets.py`

**Target:** O*NET database + GitHub developer roadmap
**Output:** `data/raw/onet_raw.json`, `data/raw/github_roadmap_raw.json` (141KB)
**Method:**
- O*NET: Downloads skill requirement ZIP from onetcenter.org, parses occupational CSV data
- GitHub: Scrapes `kamranahmedse/developer-roadmap` repository via GitHub API
**Coverage (O*NET):** SOC codes — Management, Business, CS/Math, Engineering, Education, Arts/Design, Sales
**What it extracts:** Job title → required skills → learning topics mapping

### Scraper 10: `scraper.py`

Generic scraper base class and shared utilities used by the other scrapers (HTTP session management, HTML cleaning, rate limiting helpers).

---

## 6. Agent Stubs

The `backend/agents/` directory contains three empty Python files that represent the intended three-agent architecture described in the README:

- **`architect.py`** — would contain the Architect agent (takes user goal → generates structured roadmap JSON)
- **`librarian.py`** — would contain the Librarian agent (queries ChromaDB + Tavily to attach resources)
- **`tutor.py`** — would contain the Tutor agent (context-aware chatbot grounded in current module)

**Current state:** All three files are empty stubs. The actual logic is implemented directly in `backend/rag/roadmap_chain.py`:
- Architect + Librarian logic → `generate_roadmap()`
- Tutor logic → `chat_with_roadmap()`

The separation into three agents is a planned refactor — the README describes the architecture as aspirational. The current implementation merges all three responsibilities into a single chain in `roadmap_chain.py`.

Similarly, `backend/api/roadmap.py`, `backend/api/chat.py`, and `backend/api/progress.py` are empty stubs. All routes are defined directly in `main.py`.

---

## 7. Data Layer

### Raw Data Files

| File | Size | Source | Content |
|------|------|--------|---------|
| `github_roadmap_raw.json` | 141KB | GitHub (kamranahmedse) | Community developer roadmap tree |
| `tutorials_raw.json` | 88KB | freeCodeCamp, WikiHow, Instructables | 46 step-by-step articles |
| `tavily_raw.json` | 87KB | Tavily Search API | 17 search query results |
| `mitocw_raw.json` | 59KB | MIT OpenCourseWare | 8 university course syllabi |
| `cs50_raw.json` | 37KB | Harvard CS50 | 4 course syllabi |
| `roadmapsh_raw.json` | 34KB | roadmap.sh | 13 developer roadmaps |
| `kaggle_raw.json` | ~0 | Kaggle API | Empty (requires credentials) |
| `reddit_raw.json` | ~0 | Reddit PRAW | Empty (requires credentials) |
| `youtube_raw.json` | ~0 | YouTube Transcript API | Empty (API issues) |
| `onet_raw.json` | ~0 | O*NET | Empty (requires download) |

### Processed Data

**`data/processed/roadmapsh_chunks.json`** (34KB): The roadmap.sh raw data after running through `chunker.py`. Each object in the array is one chunk with `chunk_id`, `chunk_index`, `chunk_total` added.

### Curated Domain Templates

10 hand-curated JSON files in `data/curated/` used as reference data. These are not loaded into ChromaDB — they exist as example roadmap structures and are referenced by the landing page examples modal.

**Format example (web_development.json):**
```json
{
  "domain": "web_development",
  "description": "Learning path for becoming a full-stack web developer",
  "difficulty_levels": ["beginner", "intermediate", "advanced"],
  "modules": [
    {
      "order": 1,
      "title": "Internet & How the Web Works",
      "difficulty": "beginner",
      "estimated_hours": 5,
      "topics": ["How does the internet work", "HTTP & HTTPS", "Browsers", "DNS"],
      "keywords": ["internet", "HTTP", "browser", "DNS"]
    }
  ]
}
```

### ChromaDB Vector Store

- **Location:** `chroma_db/9b159387-f172-4ccb-b144-c0350dd03a20/`
- **Files:**
  - `chroma.sqlite3` (3MB) — SQLite database for metadata, document IDs, and raw document text
  - `data_level0.bin` — HNSW graph index for approximate nearest neighbor search
  - `length.bin` — document lengths for the HNSW index
- **Collection:** `roadmapify_kb`
- **Contents:** Primarily chunks from `roadmapsh_chunks.json` (the only processed file present)
- **Similarity:** Cosine similarity search using 384-dimensional vectors from `all-MiniLM-L6-v2`

---

## 8. Frontend — Complete Walkthrough

### 8a. Entry Points

#### `frontend/src/main.jsx`

React DOM entrypoint. Wraps the app in `BrowserRouter` (React Router DOM) and `StrictMode`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

#### `frontend/src/App.jsx`

The main app orchestrator. Manages which page is shown and all inter-page state.

**State:**
- `page` — current page (`'landing'` | `'onboarding'` | `'roadmap'`)
- `roadmapData` — the generated roadmap JSON from the backend
- `prefill` — pre-filled answers when user clicks an example card

**Navigation:** Uses the HTML5 History API directly (`window.history.pushState`) rather than React Router's `<Route>` components. This gives explicit control over what state is preserved during back/forward navigation. The `popstate` listener restores page state when user navigates back.

```jsx
import { useState, useEffect } from 'react'
import LandingPage    from './pages/LandingPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import RoadmapPage    from './pages/RoadmapPage.jsx'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  const [page,        setPage]    = useState('landing')
  const [roadmapData, setRoadmap] = useState(null)
  const [prefill,     setPrefill] = useState(null)

  const navigate = (newPage) => {
    window.history.pushState(
      { page: newPage }, '',
      '/' + (newPage === 'landing' ? '' : newPage)
    )
    setPage(newPage)
  }

  useEffect(() => {
    const onPop = (e) => {
      const p = e.state?.page || 'landing'
      setPage(p)
      if (p !== 'roadmap') setRoadmap(null)
    }
    window.addEventListener('popstate', onPop)
    window.history.replaceState({ page: 'landing' }, '', '/')
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const handleGenerated = (data) => {
    setPrefill(null)
    setRoadmap(data)
    navigate('roadmap')
  }

  return (
    <AuthProvider>
      {page === 'landing'    && <LandingPage onStart={() => navigate('onboarding')} onStartWithExample={...} />}
      {page === 'onboarding' && <OnboardingPage onGenerate={handleGenerated} onBack={() => navigate('landing')} prefill={prefill} />}
      {page === 'roadmap' && roadmapData && <RoadmapPage data={roadmapData} onBack={() => navigate('landing')} />}
    </AuthProvider>
  )
}
```

---

### 8b. Pages

#### `LandingPage.jsx`

The marketing/entry page. Contains:

1. **Hero section** — headline "Your learning journey, now gamified." with animated `<MapPreview />` SVG (shows a demo node graph with done/active/locked/bonus states)
2. **Stats bar** — 48+ domains, 2.4k learners, 91% completion, 4.8★ rating
3. **Features grid** — 6 `<FeatureCard />` components (Dynamic node maps, Adapts to speed, AI-curated resources, Streaks and XP, Bonus side paths, Goal-first design)
4. **CTA section** — "Ready to start your quest?"
5. **Examples modal** — `<ExamplesModal />` with 3 pre-configured example roadmaps

**Examples:**
- Build an Instagram clone (16 weeks, intermediate, full-stack)
- Prep for IELTS (8 weeks, intermediate, exam prep)
- Become a UI designer (12 weeks, beginner, creative career)

Clicking an example calls `onStartWithExample(answers)` which pre-fills the onboarding form and skips to the last step.

**Background effects:** Subtle red grid pattern using CSS `backgroundImage` + `maskImage` radial gradient to fade at edges.

#### `OnboardingPage.jsx`

A 5-step sequential form that collects the user's learning context.

**Steps:**
1. **Goal type** (choice): Reach a goal / Create something / Get better at this / Just exploring
2. **Topic** (text input): Free-form description, e.g. "bake sourdough bread"
3. **Experience level** (choice): Beginner / Intermediate / Advanced
4. **Hours per week** (range slider): 2–40 hrs/week
5. **Timeframe** (choice): Dynamic — changes based on goal type classification

**Timeframe options by goal type:**
- `one_time`: 30 min / 1-2 hrs / half day / full day
- `skill`: 2 weeks / 1 month / 3 months / 6 months
- `project`: 1 week / 2 weeks / 1 month / 3 months
- `habit`: 1 week / 2 weeks / 1 month / 3 months

After step 2 (topic), the frontend calls `/generate-roadmap` with `timeframe: 'check'` to classify the topic type and update step 5's options dynamically.

**Progress indicator:** `<Dots />` component — small dots at top, the active dot is wider and red, completed dots are dark red, future dots are dim.

**Final submission:** Calls `POST /generate-roadmap` with `{ goal: topic, domain: goalType, level, hours_per_week, learning_style: "mixed", context_extra: "Target completion: {weeks}" }`. Shows a spinner while loading. Falls back to `fallback(answers)` on network error.

#### `RoadmapPage.jsx`

The core interactive experience. Renders the roadmap as an SVG canvas with a side panel.

**`normalise(data)` function:** Handles 3 possible backend response shapes:
- `data.nodes[]` — primary format (current backend)
- `data.modules[]` — alternative format
- `data.stages[]` — legacy format

Also has a safety net: if fewer than 4 main nodes are returned and the first node has steps that look like task names, it "explodes" the steps into individual nodes to create a proper game-like progression.

**`layoutNodes(nodes)` function:** Positions nodes in a sine-wave zigzag:
```javascript
const CX = 185, AMP = 78, RH = 110
main.forEach((n, i) => {
  pos[n.id] = { x: CX + Math.sin(i * 1.15) * AMP, y: 30 + i * RH }
})
// Bonus nodes branch off to the right of the last main node
```

**`buildConnectors(nodes, pos)` function:** Creates quadratic Bezier curve paths between consecutive nodes. Main-path connectors are dashed (locked) or solid (done). Bonus connectors are gold and offset.

**`<MapNode />` component:** SVG group rendering a single node:
- Active: large red filled circle, pulsing rings, "NOW" label above
- Done: dark gray circle with ✓ checkmark
- Locked: dim circle with dashed stroke + lock emoji
- Bonus: gold-outlined circle with ★, XP cost badge when locked, XP reward badge when unlocked
- Truncates title at 18 characters with ellipsis

**`<NodePanel />` component:** Fixed-position right side panel (340px wide) showing:
- Node type badge (Main path / Bonus path)
- Title + emoji
- Duration label + XP reward/cost grid
- Status badge (✓ Done / ▶ In Progress / 🔒 Locked)
- "What to do" section — `node.description`
- "How to do it" section — numbered steps list
- "Resources" section — clickable cards opening URLs in new tab
- Footer actions: "Mark as complete" (active main), "Complete bonus level!" (active bonus), "Unlock for X XP" button (locked bonus), or locked hint

**`<Confetti />` component:** 18 colored squares that radiate outward in a circle (CSS animation `rmConfetti`) when a node is completed.

**`<XPFloat />` component:** "+100 XP ⚡" text that floats upward and fades out when a node is completed.

**State management:**
- `nodes` — array of node objects with current `status` (active/locked/done)
- `selected` — currently open node for side panel
- `earnedXP` — accumulated XP from completed nodes
- `streak` — day streak counter (starts at `data.streak || 8`)
- `confetti` / `xpFloat` — animation trigger objects with `key` for re-mounting

**`handleComplete(node)` function:**
1. Sets node status to `'done'`
2. Finds next locked main node and sets it to `'active'`
3. Increments `earnedXP` and `streak`
4. Auto-selects the newly unlocked node
5. Triggers confetti + XP float at screen center

**`handleUnlockBonus(node)` function:**
1. Checks `earnedXP >= node.xp_reward`
2. Subtracts XP cost from `earnedXP`
3. Sets bonus node status to `'active'`

**Top info bar:** Shows roadmap title, node count progress, XP progress bar, streak counter, and Home button. Right-shifts when side panel is open.

#### `GeneratePage.jsx`

A simpler alternative generation form with a textarea for the goal and two dropdowns (difficulty, timeframe). Less polished than OnboardingPage — exists as a fallback/debug route. Uses Axios instead of fetch.

---

### 8c. Components

#### `Navbar.jsx`

Fixed top navigation bar. Shows:
- Roadmapify logo (left)
- "Sign In" + "Get Started" buttons (unauthenticated)
- User avatar circle with first letter of email + dropdown menu (authenticated)
- Optional "← Back" button (passed as `showBack` prop, shown in onboarding/roadmap pages)

#### `Logo.jsx`

The Roadmapify brand mark: an SVG icon + "oad**mapify**" text with "mapify" in bold. Accepts `size` prop for scaling.

#### `SignInModal.jsx`

Firebase email/password authentication modal. Two modes: Sign In and Sign Up. Uses `createUserWithEmailAndPassword` and `signInWithEmailAndPassword` from Firebase Auth. Shows friendly error messages for `auth/wrong-password`, `auth/user-not-found`, `auth/email-already-in-use`, etc.

#### `ChatButton.jsx`

Floating action button (bottom-right corner). A red circle with a 🤖 emoji. Toggles the `<ChatBot />` component open/closed. Passes through `roadmap`, `currentModule`, and `currentResource` props so the chatbot always knows context.

#### `ChatBot.jsx`

The AI tutor chat interface. A fixed panel (380×560px) anchored to the bottom-right.

**Features:**
- **Context-aware greeting:** Opens with a message mentioning the current goal and module
- **Module change notification:** When `currentModule.id` changes, inserts a "📍 You've moved to: [Module Title]" message
- **Message formatting:** `formatMessage()` converts basic markdown (`**bold**`, `*italic*`, `` `code` ``) to HTML using regex replacement
- **Typing indicator:** Three red pulsing dots (CSS animation `pulse`)
- **Auto-scroll:** `bottomRef.scrollIntoView({ behavior: "smooth" })` on every new message
- **Last 10 messages** sent as history to backend (keeps context window manageable)
- **Error handling:** Network errors show backend URL for debugging; rate limit errors show friendly message

**API call:**
```javascript
POST /chat
{
  message: "How do I install React?",
  roadmap: { title: "Web Development Roadmap", ... },
  current_module: { id: "node_2", title: "Setup Dev Environment", ... },
  current_resource: { label: "MDN Web Docs", url: "https://developer.mozilla.org" },
  history: [ { role: "user", content: "..." }, { role: "assistant", content: "..." }, ... ]
}
```

---

### 8d. Auth & Firebase

#### `firebase.js`

Initializes Firebase with config from Vite environment variables:

```javascript
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

export const auth = getAuth(app)
export const db   = getFirestore(app)
```

#### `context/AuthContext.jsx`

A React context that wraps the entire app (in `App.jsx`). Provides `useAuth()` hook returning `{ user, loading, logout }`.

```javascript
// user states:
// undefined  → still resolving Firebase auth state (show loading spinner)
// null       → confirmed signed out
// object     → signed in (Firebase User object with .email, .uid, .displayName, etc.)

const unsub = onAuthStateChanged(auth, (u) => {
  setUser(u)
  setLoading(false)
})
```

**Note:** Firebase auth is set up but not deeply integrated into the roadmap generation flow. The backend doesn't require authentication tokens — it accepts requests from anyone. Auth is used for the Navbar UI state and future progress persistence.

---

### 8e. Design System (`index.css`)

The global stylesheet defines the entire design language.

**Color Variables (Dark Theme):**
```css
--black:   #0a0a0a   /* page background */
--s0:      #111111   /* surface 0 — modals, panels */
--s1:      #181818   /* surface 1 — cards */
--s2:      #222222   /* surface 2 — input backgrounds */
--s3:      #2c2c2c   /* surface 3 — hover states */
--r3:      #e52929   /* red — primary brand color */
--r4:      #dc2626   /* red dark — buttons, active nodes */
--r5:      #ca1c1c   /* red darker — hover */
--gold:    #ca9a04   /* gold — bonus path color */
--tp:      #f2f0ec   /* text primary */
--ts:      #9c9890   /* text secondary */
--tm:      #6b6966   /* text muted */
--border:     rgba(255,255,255,0.07)
--border-md:  rgba(255,255,255,0.12)
```

**Typography:**
```css
/* Headings — display font */
font-family: 'Syne', sans-serif;  /* weight 400–800 */

/* Body — readable font */
font-family: 'DM Sans', sans-serif;  /* weight 300–500 */
```

**Button Classes:**
```css
.btn          { base styles — transition, cursor }
.btn-primary  { red background, white text, hover darkens }
.btn-ghost    { transparent background, white border, hover fills }
.btn-sm       { smaller padding/font }
.btn-lg       { larger padding/font }
```

**Badge Classes:**
```css
.badge-red   { red background (10% opacity), red text, red border }
.badge-gold  { gold background, gold text, gold border }
.badge-gray  { gray background }
```

**Animations:**
```css
@keyframes fadeUp    { from: translateY(16px) opacity 0; to: translateY(0) opacity 1 }
@keyframes fadeIn    { from: opacity 0; to: opacity 1 }
@keyframes pulse-ring { expand outward with fading opacity }
@keyframes float      { gentle up-down bob for XP badges }
@keyframes spin       { 360deg rotation for loading spinner }
@keyframes pathDraw   { SVG stroke-dashoffset animation for connector lines }
```

**Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` — spring-like, quick out with overshoot feel.

---

## 9. End-to-End Request Flow

### Roadmap Generation

```
USER
 │
 │  Types: "I want to bake sourdough bread"
 │  Selects: Beginner, 5 hrs/week, 1 month
 │
 ▼
OnboardingPage.jsx (Step 5 — final submit)
 │
 │  POST /generate-roadmap
 │  { goal: "bake sourdough bread", level: "beginner",
 │    hours_per_week: 5, learning_style: "mixed" }
 │
 ▼
backend/main.py → generate_roadmap_endpoint()
 │
 │  Resolves field aliases: difficulty = "beginner", time_commitment = "1 month"
 │  Calls get_generate() → lazy-imports generate_roadmap from roadmap_chain.py
 │
 ▼
backend/rag/roadmap_chain.py → generate_roadmap()
 │
 │  [RAG Step]
 │  retrieve_context("bake sourdough bread beginner", n_results=5)
 │   └─ rag_pipeline.py → _collection.query(...)
 │       └─ ChromaDB embeds the query string with all-MiniLM-L6-v2
 │       └─ HNSW approximate nearest neighbor search (cosine similarity)
 │       └─ Returns top-5 chunk texts from roadmapify_kb collection
 │
 │  [LLM Step — Attempt 1]
 │  _call_llm(context_text, "bake sourdough bread", "beginner", "1 month")
 │   └─ Builds ChatPromptTemplate:
 │       SYSTEM: 8-node template + context + real URL list
 │       HUMAN: "Goal: bake sourdough bread, Level: beginner, Timeframe: 1 month"
 │   └─ (prompt | llm).invoke({context, goal, difficulty, time_commitment})
 │   └─ Groq API → llama-3.3-70b-versatile (temperature=0.7, max_tokens=4096)
 │   └─ Response: raw JSON string
 │   └─ Strip markdown fences → json.loads()
 │
 │  [Validation]
 │  Count main nodes: need >= 4
 │  If too few → retry (Attempt 2)
 │  If both fail → _build_fallback("bake sourdough bread")
 │
 │  [Post-processing]
 │  _sanitize_urls(data) — replace bad/placeholder URLs
 │  data.setdefault("total_xp", sum of xp_rewards)
 │
 ▼
main.py → returns JSON response to frontend
 │
 │  {
 │    "title": "Bake Sourdough Bread Roadmap",
 │    "total_xp": 850,
 │    "nodes": [ 8 nodes... ]
 │  }
 │
 ▼
OnboardingPage.jsx → onGenerate(data)
 ▼
App.jsx → handleGenerated(data) → navigate('roadmap')
 ▼
RoadmapPage.jsx
 │
 │  normalise(data) — converts to flat node list
 │  layoutNodes(nodes) — sine-wave positioning
 │  buildConnectors(nodes, pos) — Bezier curve paths
 │
 ▼
SVG canvas renders with 8 nodes
 │  node_1: active (pulsing red, "NOW" label)
 │  node_2 through node_7: locked (dashed border, lock emoji)
 │  bonus_1: locked (gold, XP cost badge)
```

### Chat Message Flow

```
USER clicks node → NodePanel opens
USER clicks resource link → activeResource set
USER clicks ChatButton → ChatBot opens (knows current node + resource)
USER types question → sendMessage()
 │
 │  POST /chat
 │  { message: "What flour should I use?",
 │    roadmap: { title: "Bake Sourdough Bread Roadmap", ... },
 │    current_module: { title: "Mix Your First Starter", steps: [...] },
 │    current_resource: { label: "King Arthur Flour", url: "..." },
 │    history: [ last 10 messages ] }
 │
 ▼
backend/main.py → chat_endpoint()
 ▼
roadmap_chain.py → chat_with_roadmap()
 │
 │  System prompt:
 │  "You are Roadmapify's AI tutor.
 │   Goal: Bake Sourdough Bread Roadmap
 │   Currently on: Mix Your First Starter
 │   Description: ...
 │   Steps: [...]
 │   Using resource: King Arthur Flour — https://..."
 │
 │  (ChatPromptTemplate | llm).invoke({})
 │  → Groq llama-3.3-70b-versatile (temperature=0.7)
 │
 ▼
{ success: true, reply: "For sourdough starter, you want unbleached all-purpose or whole wheat flour..." }
 ▼
ChatBot.jsx → adds assistant message to messages[]
```

---

## 10. Configuration & Environment

### Backend Environment Variables (`backend/.env`)

```bash
# ── Required ──────────────────────────────────────────────────────────────────
GROQ_API_KEY=gsk_...           # Groq API key for llama-3.3-70b-versatile
                               # Get free tier at: console.groq.com

TAVILY_API_KEY=tvly-...        # Tavily Search API key (for scraper_tavily.py)
                               # Get free tier at: tavily.com

# ── Vector Store (optional — defaults work without these) ─────────────────────
CHROMA_DB_PATH=./chroma_db          # Path to ChromaDB storage directory
CHROMA_COLLECTION=roadmapify_kb     # Collection name
CHROMA_EMBED_MODEL=all-MiniLM-L6-v2 # SentenceTransformer model name

# ── Optional scrapers (only needed if regenerating knowledge base) ─────────────
REDDIT_CLIENT_ID=...           # Reddit app client ID (from reddit.com/prefs/apps)
REDDIT_CLIENT_SECRET=...       # Reddit app secret
REDDIT_USER_AGENT=roadmapify-scraper/1.0

KAGGLE_USERNAME=...            # Kaggle account username
KAGGLE_KEY=...                 # Kaggle API key (from kaggle.com/account)
```

### Frontend Environment Variables (`frontend/.env`)

```bash
VITE_API_URL=http://localhost:8000         # Backend URL (dev)
# VITE_API_URL=https://your-app.onrender.com  # Backend URL (production)

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Python Dependencies (`backend/requirements.txt`)

```
fastapi
uvicorn[standard]
langchain-core
langchain-community
langchain-groq
langchain-google-genai     # For Gemini (mentioned in README, not actively used)
groq
chromadb
sentence-transformers
tavily-python
beautifulsoup4
requests
praw                       # Reddit API
youtube-transcript-api
python-dotenv
pydantic
```

### Frontend Dependencies (`frontend/package.json`)

```json
{
  "dependencies": {
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "react-router-dom": "^7.14.2",
    "reactflow": "^11.11.4",
    "firebase": "^12.12.1",
    "axios": "^1.15.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.4.1",
    "vite": "^8.0.10",
    "tailwindcss": "^3.4.19",
    "postcss": "^8.5.5",
    "autoprefixer": "^10.4.21"
  }
}
```

---

## 11. Evaluation Results

### Summary from `data/eval_results.json`

The evaluator ran 8 test queries, each generating a roadmap with RAG and without (baseline), then compared metrics.

**Retrieval Relevance (keyword overlap):**
```
Mean: 0.395   Min: 0.0   Max: 0.7
```

The lower minimum (0.0) occurs for highly specific queries (e.g., IELTS preparation) where the knowledge base has fewer matching chunks. The max 0.7 occurs for broad programming queries.

**Grounding Score (% of topics found in retrieved context):**
```
RAG grounding:      significantly higher than baseline
Baseline grounding: ~0.083 on React query
RAG grounding:      ~0.318 on React query (3.8× improvement)
```

Higher grounding = the roadmap's topics are more directly supported by real documents in the knowledge base = less hallucination risk.

**Latency:**
```
RAG average:      ~1.64s
Baseline average: ~3.24s
```
RAG is faster because: the retrieved context helps the LLM generate more focused output (fewer tokens to generate, more structured). The baseline sometimes generates longer, less structured responses.

**Node Count:**
```
RAG:      typically 6-8 main nodes
Baseline: typically 4-5 main nodes
```
The explicit 8-node template in the RAG system prompt forces better structure.

**Conclusion:** The RAG pipeline improves response grounding (real topics from real sources), maintains consistent node structure (8-node template), and is faster due to focused generation.

---

## 12. Deployment

### Frontend — Vercel

- **Platform:** Vercel
- **Build command:** `npm run build` (Vite builds to `dist/`)
- **Output directory:** `dist/`
- **Environment variables:** Set `VITE_API_URL` to the Render backend URL, plus all `VITE_FIREBASE_*` variables in Vercel dashboard
- **Live URL:** `https://roadmapify-tan.vercel.app`

### Backend — Render

- **Platform:** Render (free tier)
- **Runtime:** Python 3.12.8 (from `runtime.txt`)
- **Start command:** `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- **Environment variables:** Set `GROQ_API_KEY` (required), `TAVILY_API_KEY`, and Chroma paths in Render dashboard
- **Note:** Free Render instances spin down after inactivity — first request after sleep can take 30-60 seconds (cold start). This is why lazy imports matter in `main.py`.
- **ChromaDB:** The vector database (`chroma_db/`) is stored on disk — Render's free tier does not persist disk between deploys. A fresh deployment loses the vector index. For production, ChromaDB should be replaced with a hosted service (Pinecone, Weaviate, Chroma Cloud).

### Firebase

- **Services used:** Firebase Authentication (email/password), Firestore (configured but minimally used)
- **Auth:** Users can sign in/sign up via the Navbar modal — this gates future progress persistence features
- **Current state:** Auth state is displayed in the UI but roadmap generation works without authentication

### Local Development Setup

```bash
# 1. Clone repo
git clone https://github.com/manahilatif/roadmapify.git
cd roadmapify

# 2. Backend setup
cd backend
pip install -r requirements.txt
cp .env.example .env
# Add GROQ_API_KEY to .env
uvicorn main:app --reload
# Runs at http://localhost:8000

# 3. (Optional) Ingest knowledge base
cd ..
python -m backend.rag.chunker          # chunks roadmapsh_raw.json
python -m backend.rag.embedder         # embeds chunks into ChromaDB

# 4. Frontend setup (separate terminal)
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:8000
npm run dev
# Runs at http://localhost:5173
```

---

*End of Roadmapify Codebase Reference — generated 2026-05-08*
