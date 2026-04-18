# Roadmapify
### Your all-in-one AI roadmap companion

Roadmapify turns any goal — *"build an Instagram clone in 5 days"* or *"prepare for IELTS in 6 weeks"* — into a fully personalized, interactive learning roadmap with real resources, a realistic timeline, and an AI tutor that actually knows where you are in your journey.

---

## 🌟 Unique Value Proposition

Unlike static platforms like roadmap.sh or generic AI chatbots, Roadmapify is built differently:

**Goal-Driven, Not Curriculum-Driven:** You describe what you want to achieve in plain English. Roadmapify reverse-engineers the path to get you there — for any domain, not just tech.

**Game-Level Map UI:** Your roadmap isn't a boring list. It's an interactive node map where you unlock the next stage only after completing the current one — like a game level select screen.

**RAG-Powered Resources:** Every task comes with real, verified learning resources retrieved from a knowledge base built from roadmap.sh, freeCodeCamp, MIT OCW, Reddit, YouTube transcripts, and more — no hallucinated links.

**Context-Aware AI Tutor:** The built-in chatbot knows exactly which module you're on and what resource you're using. It doesn't give generic answers — it explains things in the context of your current task.

---

## 🚀 Key Features

**Roadmap Generation:** Type a goal in natural language and get a complete, structured roadmap as an interactive visual map — modules, tasks, checkpoints, and all.

**Smart Resource Recommendations:** Every task is paired with curated YouTube videos, articles, docs, and tools — retrieved via RAG from real sources, not generated from thin air.

**Timeline Planning:** Tell Roadmapify how many hours a week you have. It builds a realistic daily and weekly schedule around your availability.

**Checkpoint Practice:** After every module, get quizzes and mini-projects to reinforce what you learned before unlocking the next stage.

**AI Tutor Chatbot:** Ask questions at any point. The tutor knows your current module, your current resource, and answers specifically in that context.

**Progress Tracking:** Mark tasks complete, watch nodes unlock, and pick up exactly where you left off.

**Dynamic Updates:** Changed your goal or need more time? Roadmapify updates your roadmap intelligently without starting from scratch.

---

## 🛠️ Tech Stack

**Frontend:** React.js + TailwindCSS + React Flow — component-based UI with a game-level interactive roadmap map

**Backend:** FastAPI (Python) — async REST API with clean LangChain integration

**LLM:** Gemini 1.5 Flash — structured JSON roadmap generation with reliable output formatting

**Orchestration:** LangChain — manages the three-agent pipeline (Architect, Librarian, Tutor)

**RAG Pipeline:** ChromaDB — vector store for the scraped knowledge base with metadata-filtered semantic retrieval

**Live Search:** Tavily API — real-time web search for verified resource links

**Auth:** Firebase Authentication — user session management and progress persistence

**Hosting:** Vercel (frontend) + Render (backend)

---

## 🏗️ Architecture

Roadmapify runs on a three-agent pipeline:

**The Architect** — takes the user's natural language goal and generates a structured JSON roadmap with modules, tasks, timelines, and checkpoints via Gemini 1.5 Flash.

**The Librarian** — queries the RAG knowledge base (ChromaDB) and Tavily live search to attach real, verified resources to every task in the roadmap.

**The Tutor** — powers the context-aware chatbot, grounded in the user's current module and resource, so answers are always specific and relevant.
```
User Input (natural language goal)
        ↓
   The Architect
   (Gemini 1.5 Flash + LangChain)
        ↓
   The Librarian
   (ChromaDB RAG + Tavily Search)
        ↓
   Structured JSON Roadmap
        ↓
   React Flow Game Map (Frontend)
        ↓
   The Tutor (context-aware chatbot)
```

---

## 📋 Installation

**Clone the repo:**
```bash
git clone https://github.com/YOUR_USERNAME/roadmapify.git
cd roadmapify
```

**Backend Setup (FastAPI):**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Fill in your API keys in .env
uvicorn main:app --reload
```

**Frontend Setup (React):**
```bash
cd frontend
npm install
npm run dev
```

---

## 🗂️ Dataset & Knowledge Base

Roadmapify's RAG pipeline is built from real scraped content across 8 sources:

| Source | Purpose |
|--------|---------|
| roadmap.sh | Structured topic trees for domain curriculum |
| freeCodeCamp, WikiHow, Instructables | Step-by-step tutorials across tech and non-tech domains |
| MIT OCW, CS50 | Ordered academic curriculum context |
| Reddit (r/learnprogramming, r/webdev) | Real-world learner recommendations |
| YouTube (transcript API) | Full video transcripts for chatbot grounding |
| Kaggle Learning Path Index | Structured course and topic metadata |
| GitHub — kamranahmedse/developer-roadmap | Community-validated developer roadmap trees |
| O*NET Database | Occupational skill requirements for non-tech domains |
