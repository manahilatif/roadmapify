"""
scraper_roadmapsh.py
--------------------
Scrapes roadmap.sh for topic trees and step-by-step content.

Roadmap.sh structure:
  - /roadmaps page lists all available roadmaps (frontend, backend, devops, etc.)
  - Each roadmap has a detail page with a list of topics/skills

We extract:
  - roadmap name + slug
  - list of topics per roadmap
  - For each topic: title, description, linked resources

Output: List[dict] — each dict is one "document" ready for chunking.
"""

import time
import requests
from bs4 import BeautifulSoup
from typing import Optional


BASE_URL = "https://roadmap.sh"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; Roadmapify/1.0; "
        "+https://github.com/yourteam/roadmapify)"
    )
}

# ── Roadmaps we care about (slug → display name) ─────────────────────────────
# Full list: https://roadmap.sh/roadmaps
# Subset chosen to match our curated domain JSON files + common dev paths
TARGET_ROADMAPS = {
    "frontend": "Frontend Development",
    "backend": "Backend Development",
    "devops": "DevOps",
    "full-stack": "Full Stack Development",
    "python": "Python",
    "javascript": "JavaScript",
    "react": "React",
    "data-structures-and-algorithms": "Data Structures & Algorithms",
    "system-design": "System Design",
    "sql": "SQL",
    "docker": "Docker",
    "git-github": "Git & GitHub",
    "computer-science": "Computer Science",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_soup(url: str, retries: int = 3) -> Optional[BeautifulSoup]:
    """Fetch a URL and return a BeautifulSoup object. Retries on failure."""
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            print(f"  [WARN] Attempt {attempt + 1}/{retries} failed for {url}: {e}")
            time.sleep(2 ** attempt)  # exponential backoff: 1s, 2s, 4s
    return None


def clean_text(text: str) -> str:
    """Normalize whitespace and strip junk."""
    return " ".join(text.split()).strip()


# ── Scraper functions ─────────────────────────────────────────────────────────

def scrape_roadmap_overview(slug: str, name: str) -> list[dict]:
    """
    Scrape a single roadmap page from roadmap.sh.

    roadmap.sh renders roadmaps as SVG/canvas *and* has a fallback
    text guide at /roadmaps/<slug>. We scrape the text guide section
    which lists topics with descriptions.

    Returns a list of document dicts — one per topic/section found.
    """
    url = f"{BASE_URL}/{slug}"
    print(f"[scrape] {name} → {url}")
    soup = get_soup(url)
    if not soup:
        print(f"  [SKIP] Could not fetch {url}")
        return []

    documents = []

    # ── Strategy 1: grab structured heading + paragraph blocks ──────────────
    # roadmap.sh guide pages use h2/h3 headings with p/ul/ol beneath them
    content_area = (
        soup.find("div", class_="prose")
        or soup.find("main")
        or soup.find("article")
        or soup.body
    )

    if not content_area:
        return []

    current_topic = None
    current_text_parts = []

    def flush_topic():
        nonlocal current_topic, current_text_parts
        if current_topic and current_text_parts:
            body = clean_text(" ".join(current_text_parts))
            if len(body) > 40:          # skip near-empty topics
                documents.append({
                    "source": "roadmap.sh",
                    "domain": slug,
                    "roadmap": name,
                    "topic": current_topic,
                    "content": body,
                    "url": url,
                    "content_type": "roadmap_topic",
                })
        current_topic = None
        current_text_parts = []

    for tag in content_area.find_all(
        ["h1", "h2", "h3", "h4", "p", "li", "ul", "ol"], recursive=True
    ):
        tag_name = tag.name
        text = clean_text(tag.get_text(separator=" "))
        if not text:
            continue

        if tag_name in ("h1", "h2", "h3", "h4"):
            flush_topic()
            current_topic = text
        elif tag_name in ("p", "li") and current_topic:
            current_text_parts.append(text)

    flush_topic()

    # ── Strategy 2: fallback — if no structured content found, grab meta ─────
    if not documents:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            documents.append({
                "source": "roadmap.sh",
                "domain": slug,
                "roadmap": name,
                "topic": f"{name} Overview",
                "content": clean_text(meta_desc["content"]),
                "url": url,
                "content_type": "roadmap_overview",
            })

    print(f"  → {len(documents)} topic blocks extracted")
    return documents


def scrape_all_roadmaps(
    target_roadmaps: dict = TARGET_ROADMAPS,
    delay: float = 1.5,
) -> list[dict]:
    """
    Scrape all target roadmaps. Returns a flat list of document dicts.

    Args:
        target_roadmaps: dict of {slug: display_name}
        delay: seconds to wait between requests (be polite to the server)
    """
    all_documents = []
    for slug, name in target_roadmaps.items():
        docs = scrape_roadmap_overview(slug, name)
        all_documents.extend(docs)
        time.sleep(delay)

    print(f"\n[done] Total documents scraped: {len(all_documents)}")
    return all_documents


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json, pathlib

    output_path = pathlib.Path("data/raw/roadmapsh_raw.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docs = scrape_all_roadmaps()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(docs)} documents → {output_path}")