"""
scraper_mitocw.py
-----------------
Scrapes MIT OpenCourseWare (ocw.mit.edu) for course syllabi and topic lists.

What we extract:
  - Course title and description
  - Syllabus / topics covered (ordered list of lecture topics)
  - Prerequisites
  - Calendar / schedule (week-by-week or lecture-by-lecture breakdown)

Why this matters for Roadmapify:
  - MIT syllabi give us academically validated topic orderings
  - "What comes before what" — prerequisite chains
  - Used to validate and enrich roadmaps for CS/math/data science domains

Target courses (chosen to cover our supported domains):
  - 6.0001 — Introduction to CS using Python
  - 6.006  — Introduction to Algorithms
  - 6.042  — Math for CS
  - 18.06  — Linear Algebra (for data science)
  - 6.036  — Introduction to Machine Learning
  - 6.031  — Software Construction (good practices)

Output: data/raw/mitocw_raw.json
"""

import time
import json
import pathlib
import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; Roadmapify/1.0 Academic Scraper; "
        "+https://github.com/yourteam/roadmapify)"
    )
}

DELAY = 2.0   # seconds between requests

# ── Target courses ────────────────────────────────────────────────────────────
# Format: (course_id, display_name, domain_tag, url_slug)
# URL pattern: https://ocw.mit.edu/courses/{slug}/
TARGET_COURSES = [
    (
        "6.0001",
        "Introduction to Computer Science and Programming in Python",
        "python",
        "6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016",
    ),
    (
        "6.006",
        "Introduction to Algorithms",
        "dsa",
        "6-006-introduction-to-algorithms-spring-2020",
    ),
    (
        "6.042J",
        "Mathematics for Computer Science",
        "computer_science",
        "6-042j-mathematics-for-computer-science-fall-2010",
    ),
    (
        "18.06",
        "Linear Algebra",
        "data_science",
        "18-06-linear-algebra-spring-2010",
    ),
    (
        "6.036",
        "Introduction to Machine Learning",
        "data_science",
        "6-036-introduction-to-machine-learning-fall-2020",
    ),
    (
        "6.031",
        "Software Construction",
        "computer_science",
        "6-031-elements-of-software-construction-spring-2023",
    ),
    (
        "6.004",
        "Computation Structures",
        "computer_science",
        "6-004-computation-structures-spring-2017",
    ),
    (
        "6.046J",
        "Design and Analysis of Algorithms",
        "dsa",
        "6-046j-design-and-analysis-of-algorithms-spring-2015",
    ),
]

BASE_URL = "https://ocw.mit.edu/courses"


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_soup(url: str, retries: int = 3) -> BeautifulSoup | None:
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            print(f"  [WARN] Attempt {attempt+1}/{retries} failed: {e}")
            time.sleep(2 ** attempt)
    return None


def clean(text: str) -> str:
    return " ".join(text.split()).strip()


def extract_list_items(tag) -> list[str]:
    """Extract all <li> text from a tag."""
    if not tag:
        return []
    return [clean(li.get_text()) for li in tag.find_all("li") if clean(li.get_text())]


# ── Per-course scraping ───────────────────────────────────────────────────────

def scrape_course_pages(course_id: str, name: str, domain: str, slug: str) -> list[dict]:
    """
    Scrape a single MIT OCW course. Tries to get:
      1. Syllabus page
      2. Calendar / schedule page
      3. Course home (description + prerequisites)

    Returns list of document dicts (one per page successfully scraped).
    """
    course_url = f"{BASE_URL}/{slug}"
    documents = []

    pages_to_try = [
        ("syllabus",  f"{course_url}/pages/syllabus/",  "syllabus"),
        ("calendar",  f"{course_url}/pages/calendar/",  "course_calendar"),
        ("home",      f"{course_url}/",                 "course_overview"),
    ]

    for page_name, url, content_type in pages_to_try:
        print(f"  [{page_name}] {url}")
        soup = get_soup(url)
        if not soup:
            print(f"    → failed, skipping")
            time.sleep(DELAY)
            continue

        # Find main content area
        main = (
            soup.find("div", class_="course-content")
            or soup.find("main")
            or soup.find("article")
            or soup.find("div", {"id": "content"})
            or soup.body
        )

        if not main:
            time.sleep(DELAY)
            continue

        # Extract all meaningful text blocks
        text_parts = []
        for tag in main.find_all(["h1", "h2", "h3", "h4", "p", "li", "td"], recursive=True):
            t = clean(tag.get_text(separator=" "))
            if t and len(t) > 15:
                text_parts.append(t)

        content = " | ".join(text_parts)

        if len(content) < 100:
            print(f"    → too short ({len(content)} chars), skipping")
            time.sleep(DELAY)
            continue

        documents.append({
            "source":       "mit_ocw",
            "domain":       domain,
            "roadmap":      name,
            "topic":        f"{name} — {page_name.title()}",
            "url":          url,
            "content":      content[:8000],   # cap at 8KB per page
            "content_type": content_type,
            "course_id":    course_id,
        })

        print(f"    → {len(content)} chars extracted")
        time.sleep(DELAY)

    return documents


# ── Master runner ─────────────────────────────────────────────────────────────

def scrape_all_courses() -> list[dict]:
    all_docs = []

    for course_id, name, domain, slug in TARGET_COURSES:
        print(f"\n[mit_ocw] {course_id}: {name}")
        docs = scrape_course_pages(course_id, name, domain, slug)
        all_docs.extend(docs)
        print(f"  → {len(docs)} pages scraped")

    print(f"\n[mit_ocw] Total: {len(all_docs)} documents")
    return all_docs


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output_path = pathlib.Path("data/raw/mitocw_raw.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docs = scrape_all_courses()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(docs)} documents → {output_path}")