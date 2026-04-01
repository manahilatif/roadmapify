"""
scraper_cs50.py
---------------
Scrapes CS50's public course pages for syllabus, week-by-week topics,
and lecture summaries.

Covers:
  - CS50x  (Intro to CS — Harvard's flagship free course)
  - CS50P  (Python)
  - CS50W  (Web Development)
  - CS50AI (Artificial Intelligence)

Why CS50 for Roadmapify:
  - CS50 syllabi are extremely clean, beginner-friendly topic orderings
  - Each "Week N" maps naturally to a roadmap node
  - Lecture notes give us vocabulary / concept lists per topic
  - Widely recognized — grounding our roadmaps in CS50 structure adds credibility

Output: data/raw/cs50_raw.json
"""

import time
import json
import pathlib
import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; Roadmapify/1.0; "
        "+https://github.com/yourteam/roadmapify)"
    )
}

DELAY = 2.0

# ── Target CS50 courses ───────────────────────────────────────────────────────
# Format: (course_id, display_name, domain, base_url)
TARGET_COURSES = [
    (
        "cs50x",
        "CS50: Introduction to Computer Science",
        "computer_science",
        "https://cs50.harvard.edu/x/2024",
    ),
    (
        "cs50p",
        "CS50P: Introduction to Programming with Python",
        "python",
        "https://cs50.harvard.edu/python/2022",
    ),
    (
        "cs50w",
        "CS50W: Web Programming with Python and JavaScript",
        "full-stack",
        "https://cs50.harvard.edu/web/2020",
    ),
    (
        "cs50ai",
        "CS50AI: Introduction to Artificial Intelligence with Python",
        "data_science",
        "https://cs50.harvard.edu/ai/2024",
    ),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_soup(url: str, retries: int = 3) -> BeautifulSoup | None:
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            print(f"  [WARN] Attempt {attempt+1}/{retries} failed for {url}: {e}")
            time.sleep(2 ** attempt)
    return None


def clean(text: str) -> str:
    return " ".join(text.split()).strip()


# ── Course home page ──────────────────────────────────────────────────────────

def scrape_course_home(course_id: str, name: str, domain: str, base_url: str) -> list[dict]:
    """
    Scrape the CS50 course home page.

    CS50 home pages list all weeks with titles and brief descriptions.
    We extract week titles + descriptions as individual documents.
    """
    print(f"  [home] {base_url}")
    soup = get_soup(base_url)
    documents = []

    if not soup:
        return documents

    # CS50 uses <main> with week sections
    main = soup.find("main") or soup.body
    if not main:
        return documents

    # Try to find week-level sections
    # CS50x uses <ul> or <table> for week listing
    week_sections = []

    # Strategy 1: look for headings with "Week" in them
    for heading in main.find_all(["h2", "h3", "h4"]):
        heading_text = clean(heading.get_text())
        if not heading_text:
            continue

        # Grab the next sibling paragraph or list
        sibling = heading.find_next_sibling(["p", "ul", "ol", "div"])
        body_text = ""
        if sibling:
            body_text = clean(sibling.get_text(separator=" "))

        content = heading_text
        if body_text:
            content = f"{heading_text}: {body_text}"

        if len(content) > 30:
            week_sections.append({
                "source":       "cs50",
                "domain":       domain,
                "roadmap":      name,
                "topic":        heading_text,
                "url":          base_url,
                "content":      content[:2000],
                "content_type": "course_week",
                "course_id":    course_id,
            })

    # Strategy 2: fallback — grab entire page text as one overview doc
    if not week_sections:
        full_text_parts = []
        for tag in main.find_all(["h1","h2","h3","p","li"], recursive=True):
            t = clean(tag.get_text(separator=" "))
            if t and len(t) > 20:
                full_text_parts.append(t)

        content = " | ".join(full_text_parts)
        if len(content) > 100:
            week_sections.append({
                "source":       "cs50",
                "domain":       domain,
                "roadmap":      name,
                "topic":        f"{name} — Course Overview",
                "url":          base_url,
                "content":      content[:8000],
                "content_type": "course_overview",
                "course_id":    course_id,
            })

    print(f"    → {len(week_sections)} sections extracted")
    documents.extend(week_sections)
    return documents


def scrape_weeks_page(course_id: str, name: str, domain: str, base_url: str) -> list[dict]:
    """
    Scrape individual week/lecture pages from CS50.
    CS50 courses have pages like /weeks/0, /weeks/1, etc.
    """
    documents = []

    for week_num in range(0, 11):   # CS50x has weeks 0–10
        url = f"{base_url}/weeks/{week_num}"
        print(f"  [week {week_num}] {url}")

        soup = get_soup(url)
        if not soup:
            # If week 0+ fails, likely no more weeks
            if week_num >= 2:
                break
            time.sleep(DELAY)
            continue

        # Check if this is actually a valid week page (not 404)
        # CS50 returns 200 with a "Not Found" message for missing weeks
        page_title = soup.find("title")
        if page_title and "not found" in page_title.get_text().lower():
            break

        main = soup.find("main") or soup.body
        if not main:
            time.sleep(DELAY)
            continue

        # Extract content
        text_parts = []
        for tag in main.find_all(["h1","h2","h3","h4","p","li"], recursive=True):
            t = clean(tag.get_text(separator=" "))
            if t and len(t) > 15:
                text_parts.append(t)

        content = " | ".join(text_parts)

        if len(content) > 100:
            # Get the week title from h1
            h1 = main.find("h1")
            topic = clean(h1.get_text()) if h1 else f"{name} — Week {week_num}"

            documents.append({
                "source":       "cs50",
                "domain":       domain,
                "roadmap":      name,
                "topic":        topic,
                "url":          url,
                "content":      content[:6000],
                "content_type": "lecture_notes",
                "course_id":    course_id,
                "week":         week_num,
            })
            print(f"    → {len(content)} chars, topic: {topic[:50]}")
        else:
            print(f"    → too short, skipping")

        time.sleep(DELAY)

    return documents


# ── Master runner ─────────────────────────────────────────────────────────────

def scrape_all_cs50_courses() -> list[dict]:
    all_docs = []

    for course_id, name, domain, base_url in TARGET_COURSES:
        print(f"\n[cs50] {course_id}: {name}")

        # Home page overview
        home_docs = scrape_course_home(course_id, name, domain, base_url)
        all_docs.extend(home_docs)
        time.sleep(DELAY)

        # Individual week pages
        week_docs = scrape_weeks_page(course_id, name, domain, base_url)
        all_docs.extend(week_docs)

        print(f"  → {len(home_docs) + len(week_docs)} total docs for {course_id}")

    print(f"\n[cs50] Total: {len(all_docs)} documents")
    return all_docs


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output_path = pathlib.Path("data/raw/cs50_raw.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docs = scrape_all_cs50_courses()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(docs)} documents → {output_path}")