# Roadmapify
AI-powered personalized learning roadmap generator and companion.

## Overview
Roadmapify generates fully personalized, goal-driven learning roadmaps 
from a single natural language input — for any domain.

## Tech Stack
- Backend: FastAPI + LangChain + ChromaDB
- Frontend: React + TailwindCSS + React Flow
- LLM: Gemini 1.5 Flash
- RAG: ChromaDB + web-scraped knowledge base
- Search: Tavily API

## Setup
### Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
uvicorn main:app --reload

### Frontend
cd frontend
npm install
npm run dev
