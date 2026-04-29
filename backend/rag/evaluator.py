"""
evaluator.py
------------
Evaluates the Roadmapify RAG pipeline.
Measures: retrieval relevance, hallucination check,
baseline vs RAG comparison, and response quality.
"""

import json
import time
import os
import sys
import pathlib

# Allow running directly from repo root
sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from dotenv import load_dotenv
load_dotenv()

import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
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


def evaluate_retrieval_relevance(results: list) -> dict:
    """
    Proxy relevance scoring via keyword overlap between query and retrieved context.
    2 = highly relevant, 1 = somewhat relevant, 0 = irrelevant (rubric reference only).
    """
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


def parse_roadmap(output) -> dict:
    """
    Safely parse roadmap output — handles both str (JSON) and dict.
    """
    if isinstance(output, dict):
        return output
    try:
        return json.loads(output)
    except Exception:
        return {"stages": [], "raw": str(output)}


def evaluate_hallucination(roadmap_output: dict, context: str) -> float:
    """
    Grounding score: % of roadmap topics that appear in the retrieved context.
    Higher = more grounded in the knowledge base (less hallucination risk).
    """
    topics = []
    for stage in roadmap_output.get("stages", []):
        topics.extend(stage.get("topics", []))

    if not topics:
        return 0.0

    grounded = sum(1 for t in topics if t.lower() in context.lower())
    return round(grounded / len(topics), 3)


def baseline_generate(query: str) -> dict:
 
    from langchain_groq import ChatGroq
    from langchain_core.prompts import ChatPromptTemplate

    llm = ChatGroq(
        model="llama3-70b-8192", 
        groq_api_key=os.getenv("GROQ_API_KEY"), 
        temperature=0.3
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", "Generate a learning roadmap as JSON with fields: title, description, estimated_total_weeks, stages (each with stage_number, title, duration_weeks, topics, resources). Output ONLY valid JSON, no markdown."),
        ("human", "{query}")
    ])
    chain = prompt | llm
    result = chain.invoke({"query": query})
    return parse_roadmap(result.content)


def run_full_evaluation():
    results = []

    for test in TEST_QUERIES:
        print(f"\nEvaluating: {test['query'][:60]}...")

        # ── RAG pipeline ───────────────────────────────────────────
        context = retrieve_context(test["query"], n_results=8)

        t0 = time.time()
        rag_raw = generate_roadmap(test["query"])   # ✅ 1 argument only
        rag_time = round(time.time() - t0, 2)

        rag_output = parse_roadmap(rag_raw)          # ✅ JSON string → dict

        # ── Baseline (no retrieval) ────────────────────────────────
        t1 = time.time()
        baseline_output = baseline_generate(test["query"])
        baseline_time = round(time.time() - t1, 2)

        # ── Metrics ────────────────────────────────────────────────
        rag_stages = len(rag_output.get("stages", []))
        baseline_stages = len(baseline_output.get("stages", []))
        rag_grounding = evaluate_hallucination(rag_output, context)
        baseline_grounding = evaluate_hallucination(baseline_output, context)  # no context → low score expected

        results.append({
            "query": test["query"],
            "domain": test["domain"],
            "level": test["level"],
            "rag_stages": rag_stages,
            "baseline_stages": baseline_stages,
            "rag_grounding_score": rag_grounding,
            "baseline_grounding_score": baseline_grounding,
            "rag_latency_s": rag_time,
            "baseline_latency_s": baseline_time,
            "retrieved_context": context[:500],
        })

        time.sleep(5)

        print(f"  RAG stages: {rag_stages} | grounding: {rag_grounding} | latency: {rag_time}s")
        print(f"  Baseline stages: {baseline_stages} | grounding: {baseline_grounding} | latency: {baseline_time}s")

    # ── Retrieval relevance across all queries ─────────────────────
    relevance_summary = evaluate_retrieval_relevance(results)

    output = {
        "results": results,
        "retrieval_relevance_summary": relevance_summary,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/eval_results.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅ Evaluation complete. Results saved to data/eval_results.json")
    print(f"   Retrieval relevance summary: {relevance_summary}")
    return output


if __name__ == "__main__":
    run_full_evaluation()