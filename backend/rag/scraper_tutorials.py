"""
scraper_tutorials.py
--------------------
Scrapes step-by-step tutorial articles from:
  - freeCodeCamp (freecodecamp.org/news) — dev tutorials
  - WikiHow (wikihow.com)                — life skills, creative domains
  - Instructables (instructables.com)    — crafts, cooking, making

Target: ~10-15 articles per site covering all supported Roadmapify domains.
Output: data/raw/tutorials_raw.json
"""

import time
import json
import pathlib
import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}
DELAY   = 2.0
TIMEOUT = 20

# ── Article target lists ──────────────────────────────────────────────────────

FCC_ARTICLES = [
    ("https://www.freecodecamp.org/news/html-css-tutorial-for-beginners/",           "frontend",     "HTML & CSS Basics"),
    ("https://www.freecodecamp.org/news/javascript-es6-tutorial-for-beginners/",     "javascript",   "JavaScript ES6"),
    ("https://www.freecodecamp.org/news/react-tutorial-for-beginners/",              "frontend",     "React"),
    ("https://www.freecodecamp.org/news/css-flexbox-tutorial-with-cheatsheet/",      "frontend",     "CSS Flexbox"),
    ("https://www.freecodecamp.org/news/git-and-github-for-beginners/",              "git",          "Git & GitHub"),
    ("https://www.freecodecamp.org/news/python-tutorial-for-beginners/",             "python",       "Python Basics"),
    ("https://www.freecodecamp.org/news/sql-tutorial-for-beginners/",                "sql",          "SQL Basics"),
    ("https://www.freecodecamp.org/news/docker-tutorial-for-beginners/",             "devops",       "Docker Basics"),
    ("https://www.freecodecamp.org/news/machine-learning-with-python/",              "data_science", "Machine Learning Python"),
    ("https://www.freecodecamp.org/news/data-analysis-with-python-pandas/",          "data_science", "Pandas for Data Analysis"),
    ("https://www.freecodecamp.org/news/big-o-notation-why-it-matters-and-why-it-doesnt-1674cfa8a23c/", "dsa", "Big O Notation"),
    ("https://www.freecodecamp.org/news/rest-api-tutorial-rest-client-rest-service-and-api-calls-explained-with-code-examples/", "backend", "REST APIs"),
    ("https://www.freecodecamp.org/news/learn-css-grid-by-building-5-layouts/",     "frontend",     "CSS Grid"),
]

WIKIHOW_ARTICLES = [
    ("https://www.wikihow.com/Learn-English",                                        "language_learning", "Learn English"),
    ("https://www.wikihow.com/Learn-a-New-Language",                                 "language_learning", "Language Learning"),
    ("https://www.wikihow.com/Improve-Your-Cooking",                                 "cooking",           "Improve Your Cooking"),
    ("https://www.wikihow.com/Learn-to-Cook",                                        "cooking",           "Learn to Cook"),
    ("https://www.wikihow.com/Bake",                                                 "baking",            "Baking Basics"),
    ("https://www.wikihow.com/Crochet-for-Beginners",                               "crochet",           "Crochet for Beginners"),
    ("https://www.wikihow.com/Start-Crocheting",                                     "crochet",           "Start Crocheting"),
    ("https://www.wikihow.com/Create-a-Digital-Marketing-Strategy",                  "digital_marketing", "Digital Marketing Strategy"),
    ("https://www.wikihow.com/Do-SEO",                                               "digital_marketing", "SEO Basics"),
    ("https://www.wikihow.com/Become-a-UX-Designer",                                "uiux_design",       "Become a UX Designer"),
    ("https://www.wikihow.com/Prepare-for-IELTS",                                    "ielts_preparation", "Prepare for IELTS"),
    ("https://www.wikihow.com/Study-Effectively",                                    "general",           "Study Effectively"),
]

INSTRUCTABLES_ARTICLES = [
    ("https://www.instructables.com/Crocheting-for-Beginners/",                     "crochet",  "Crochet Basics"),
    ("https://www.instructables.com/Basic-Crochet-Stitches/",                       "crochet",  "Crochet Stitches"),
    ("https://www.instructables.com/How-to-Bake-Bread/",                            "baking",   "Bake Bread from Scratch"),
    ("https://www.instructables.com/10-Tips-for-Beginner-Bakers/",                  "baking",   "Beginner Baking Tips"),
    ("https://www.instructables.com/Learn-to-Cook-10-Basic-Skills/",               "cooking",  "Basic Cooking Skills"),
    ("https://www.instructables.com/Knife-Skills-for-Beginners/",                   "cooking",  "Knife Skills"),
    ("https://www.instructables.com/How-to-Make-a-Website/",                        "frontend", "Make a Website"),
    ("https://www.instructables.com/Introduction-to-Digital-Photography/",          "general",  "Digital Photography Intro"),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_soup(url: str, retries: int = 3):
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as e:
            print(f"  [WARN] Attempt {attempt+1}/{retries}: {e}")
            time.sleep(2 ** attempt)
    return None


def clean(text: str) -> str:
    return " ".join(text.split()).strip()


NOISE_PHRASES = [
    "subscribe", "newsletter", "advertisement", "cookie policy",
    "sign in", "log in", "register", "did you make this project",
    "share this article", "follow us", "related articles",
]

def is_noise(text: str) -> bool:
    t = text.lower()
    return any(phrase in t for phrase in NOISE_PHRASES)


# ── freeCodeCamp scraper ──────────────────────────────────────────────────────

def scrape_fcc(url: str, domain: str, topic: str) -> dict | None:
    soup = get_soup(url)
    if not soup:
        return None

    article = soup.find("article") or soup.find("main") or soup.body
    if not article:
        return None

    title_tag = soup.find("h1")
    title = clean(title_tag.get_text()) if title_tag else topic

    parts = []
    for tag in article.find_all(["h2", "h3", "p", "li"], recursive=True):
        t = clean(tag.get_text(separator=" "))
        if t and len(t) > 20 and not is_noise(t):
            parts.append(t)

    content = " | ".join(parts)
    if len(content) < 200:
        return None

    return {
        "source": "freecodecamp", "domain": domain, "roadmap": topic,
        "topic": title, "url": url, "content": content[:8000],
        "content_type": "tutorial_article",
    }


# ── WikiHow scraper ───────────────────────────────────────────────────────────

def scrape_wikihow(url: str, domain: str, topic: str) -> dict | None:
    soup = get_soup(url)
    if not soup:
        return None

    title_tag = soup.find("h1")
    title = clean(title_tag.get_text()) if title_tag else topic

    parts = []

    # Intro
    intro = soup.find("div", class_="mf-section-0") or soup.find("div", id="intro")
    if intro:
        t = clean(intro.get_text(separator=" "))
        if t:
            parts.append(t)

    # Steps
    for step in soup.find_all("div", class_="step"):
        t = clean(step.get_text(separator=" "))
        if t and len(t) > 20 and not is_noise(t):
            parts.append(t)

    # Fallback
    if not parts:
        main = soup.find("main") or soup.body
        if main:
            for tag in main.find_all(["p", "li", "h2", "h3"], recursive=True):
                t = clean(tag.get_text())
                if t and len(t) > 20 and not is_noise(t):
                    parts.append(t)

    content = " | ".join(parts)
    if len(content) < 150:
        return None

    return {
        "source": "wikihow", "domain": domain, "roadmap": topic,
        "topic": title, "url": url, "content": content[:6000],
        "content_type": "how_to_guide",
    }


# ── Instructables scraper ─────────────────────────────────────────────────────

def scrape_instructables(url: str, domain: str, topic: str) -> dict | None:
    soup = get_soup(url)
    if not soup:
        return None

    title_tag = soup.find("h1") or soup.find("h2")
    title = clean(title_tag.get_text()) if title_tag else topic

    parts = []

    # Structured steps
    step_divs = (
        soup.find_all("section", class_=lambda c: c and "step" in c.lower())
        or soup.find_all("div", class_=lambda c: c and "step" in c.lower())
    )

    for step in step_divs:
        t = clean(step.get_text(separator=" "))
        if t and len(t) > 30 and not is_noise(t):
            parts.append(t[:500])

    # Fallback
    if not parts:
        main = soup.find("main") or soup.find("article") or soup.body
        if main:
            for tag in main.find_all(["p", "li", "h2", "h3"], recursive=True):
                t = clean(tag.get_text())
                if t and len(t) > 20 and not is_noise(t):
                    parts.append(t)

    content = " | ".join(parts)
    if len(content) < 150:
        return None

    return {
        "source": "instructables", "domain": domain, "roadmap": topic,
        "topic": title, "url": url, "content": content[:6000],
        "content_type": "how_to_guide",
    }


# ── Master runner ─────────────────────────────────────────────────────────────

def scrape_all_tutorials() -> list[dict]:
    all_docs = []

    sources = [
        ("freecodecamp", FCC_ARTICLES,           scrape_fcc),
        ("wikihow",      WIKIHOW_ARTICLES,        scrape_wikihow),
        ("instructables",INSTRUCTABLES_ARTICLES,  scrape_instructables),
    ]

    for source_name, articles, scrape_fn in sources:
        print(f"\n[{source_name}] Scraping {len(articles)} articles ...")
        for url, domain, topic in articles:
            print(f"  {topic[:55]}")
            doc = scrape_fn(url, domain, topic)
            if doc:
                all_docs.append(doc)
                print(f"    → {len(doc['content'])} chars ✓")
            else:
                print(f"    → skipped (blocked or empty)")
            time.sleep(DELAY)

    print(f"\n[tutorials] Done. {len(all_docs)} documents total.")
    return all_docs


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output_path = pathlib.Path("data/raw/tutorials_raw.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docs = scrape_all_tutorials()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(docs)} documents → {output_path}")