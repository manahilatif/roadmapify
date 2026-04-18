"""
scraper_tavily.py
-----------------
Uses the Tavily Search API to fetch real, verified learning resources
for a set of seed queries across all our supported domains.

Purpose in Phase 2:
  - Proves Tavily integration works (demo requirement)
  - Saves results as raw documents for the RAG knowledge base
  - These get chunked + embedded like any other source

Usage:
    python backend/rag/scraper_tavily.py

Requires:
    pip install tavily-python
    TAVILY_API_KEY set in backend/.env
"""

import os
import json
import time
import pathlib
from dotenv import load_dotenv

# Load .env from backend/
load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

try:
    from tavily import TavilyClient
except ImportError:
    raise ImportError("Run: pip install tavily-python")


# ── Config ────────────────────────────────────────────────────────────────────

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# Seed queries — one per domain we support
# Format: (query_string, domain_tag, roadmap_tag)
SEED_QUERIES = [
    # Web / Dev
    ("how to learn React for beginners complete roadmap",       "frontend",            "React"),
    ("how to learn backend web development roadmap 2024",       "backend",             "Backend Development"),
    ("frontend development learning path HTML CSS JavaScript",  "frontend",            "Frontend Development"),
    ("DevOps learning roadmap Docker Kubernetes CI/CD",         "devops",              "DevOps"),
    ("full stack web development roadmap beginner to advanced", "full-stack",          "Full Stack Development"),
    # Data
    ("data science learning roadmap Python pandas sklearn",     "data_science",        "Data Science"),
    ("machine learning roadmap beginner projects",              "data_science",        "Machine Learning"),
    ("SQL learning path beginner to advanced",                  "sql",                 "SQL"),
    # CS fundamentals
    ("data structures and algorithms study guide",              "dsa",                 "DSA"),
    ("system design interview preparation roadmap",             "system_design",       "System Design"),
    ("computer science fundamentals self study guide",          "computer_science",    "Computer Science"),
    # Creative / other domains
    ("IELTS preparation study plan 6 weeks",                    "ielts_preparation",   "IELTS Preparation"),
    ("UI UX design learning roadmap tools figma",               "uiux_design",         "UI/UX Design"),
    ("digital marketing learning roadmap SEO social media",     "digital_marketing",   "Digital Marketing"),
    ("learn Python programming complete beginner guide",        "python",              "Python"),
    ("learn JavaScript complete roadmap projects",              "javascript",          "JavaScript"),
    ("git and github tutorial for beginners",                   "git",                 "Git & GitHub"),
    ("docker beginner tutorial containers explained",           "docker",              "Docker"),
]

DELAY_BETWEEN_CALLS = 1.5   # seconds — stay within free tier rate limits
MAX_RESULTS_PER_QUERY = 5   # Tavily free tier: up to 5 results


# ── Tavily search ─────────────────────────────────────────────────────────────

def search_tavily(client: "TavilyClient", query: str, max_results: int = MAX_RESULTS_PER_QUERY) -> list[dict]:
    """
    Run one Tavily search and return cleaned result dicts.

    Tavily returns: title, url, content (snippet), score, published_date
    We keep all of these plus add our own metadata fields.
    """
    try:
        response = client.search(
            query=query,
            search_depth="basic",       # "basic" uses 1 credit, "advanced" uses 2
            max_results=max_results,
            include_answer=False,       # we want raw results, not a generated answer
        )
        return response.get("results", [])
    except Exception as e:
        print(f"  [ERROR] Tavily search failed for '{query}': {e}")
        return []


def run_all_searches(api_key: str = None) -> list[dict]:
    """
    Run all seed queries and return a flat list of document dicts
    ready for chunking.

    Each document dict has:
      source, domain, roadmap, topic, url, content, content_type,
      tavily_score, query (the original search query)
    """
    key = api_key or TAVILY_API_KEY
    if not key:
        raise ValueError(
            "TAVILY_API_KEY not set. Add it to backend/.env:\n"
            "  TAVILY_API_KEY=tvly-xxxxxxxxxxxx"
        )

    client = TavilyClient(api_key=key)
    all_documents = []
    seen_urls = set()   # deduplicate across queries

    print(f"[tavily] Running {len(SEED_QUERIES)} queries ...\n")

    for i, (query, domain, roadmap) in enumerate(SEED_QUERIES):
        print(f"[{i+1}/{len(SEED_QUERIES)}] {query[:60]}")
        results = search_tavily(client, query)

        for r in results:
            url = r.get("url", "")
            if url in seen_urls:
                continue
            seen_urls.add(url)

            content = r.get("content", "").strip()
            if not content or len(content) < 50:
                continue    # skip near-empty snippets

            all_documents.append({
                "source":       "tavily",
                "domain":       domain,
                "roadmap":      roadmap,
                "topic":        r.get("title", query),
                "url":          url,
                "content":      content,
                "content_type": "web_article",
                "tavily_score": r.get("score", 0.0),
                "query":        query,
            })

        print(f"  → {len(results)} results ({len(all_documents)} total so far)")
        time.sleep(DELAY_BETWEEN_CALLS)

    print(f"\n[tavily] Done. {len(all_documents)} unique documents collected.")
    return all_documents


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output_path = pathlib.Path("data/raw/tavily_raw.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docs = run_all_searches()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(docs)} documents → {output_path}")

    # Print a sample
    if docs:
        print("\n[sample]")
        d = docs[0]
        for k, v in d.items():
            print(f"  {k}: {str(v)[:80]}")