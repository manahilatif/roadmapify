"""
scraper_kaggle.py
-----------------
Downloads and processes Kaggle learning path / course metadata for the
Roadmapify RAG knowledge base.

What we get from Kaggle:
  - Course titles, descriptions, skills covered
  - Structured topic-to-course mappings
  - Difficulty levels and prerequisites

Two modes:
  1. Kaggle API (recommended) — downloads dataset programmatically
  2. Manual CSV fallback — if you already downloaded the CSV manually

Relevant Kaggle datasets:
  - "nikhilmittal/coursera-course-dataset-v2"
  - "siddharthm1/coursera-dataset"

For Roadmapify Phase 2, we use a curated CSV approach:
  We load any CSVs from data/raw/kaggle/ and convert them into
  the standard document format for chunking.

Usage:
    python backend/rag/scraper_kaggle.py

Requires (for API mode):
    pip install kaggle
    ~/.kaggle/kaggle.json with your API credentials
    OR set KAGGLE_USERNAME and KAGGLE_KEY in backend/.env
"""

import os
import json
import pathlib
import csv
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

KAGGLE_DIR  = pathlib.Path("data/raw/kaggle")
OUTPUT_PATH = pathlib.Path("data/raw/kaggle_raw.json")

TARGET_DATASETS = [
    "nikhilmittal/coursera-course-dataset-v2",
    "siddharthm1/coursera-dataset",
]


# ── Kaggle API download ───────────────────────────────────────────────────────

def download_via_kaggle_api() -> bool:
    """
    Download target datasets using the Kaggle API.
    Returns True if successful, False if API not configured.

    One-time setup:
      1. kaggle.com → Account → Create API Token → downloads kaggle.json
      2. Place at C:/Users/<Name>/.kaggle/kaggle.json  (Windows)
                 or ~/.kaggle/kaggle.json              (Mac/Linux)
      3. pip install kaggle
    """
    try:
        import kaggle
    except ImportError:
        print("[kaggle] Package not installed. Run: pip install kaggle")
        return False

    kaggle_json = pathlib.Path.home() / ".kaggle" / "kaggle.json"
    env_key     = os.getenv("KAGGLE_KEY")

    if not kaggle_json.exists() and not env_key:
        print("[kaggle] No credentials found.")
        print("  Option A: Download kaggle.json from kaggle.com/account")
        print("            and place at ~/.kaggle/kaggle.json")
        print("  Option B: Add to backend/.env:")
        print("            KAGGLE_USERNAME=your_username")
        print("            KAGGLE_KEY=your_api_key")
        return False

    KAGGLE_DIR.mkdir(parents=True, exist_ok=True)

    for dataset_slug in TARGET_DATASETS:
        print(f"[kaggle] Downloading: {dataset_slug}")
        try:
            kaggle.api.dataset_download_files(
                dataset_slug,
                path=str(KAGGLE_DIR / dataset_slug.split("/")[1]),
                unzip=True,
            )
            print(f"  → saved to {KAGGLE_DIR / dataset_slug.split('/')[1]}")
        except Exception as e:
            print(f"  [WARN] Failed: {e}")

    return True


# ── CSV parser ────────────────────────────────────────────────────────────────

def infer_domain(text: str) -> str:
    text = text.lower()
    if any(k in text for k in ["python", "pandas", "numpy", "scikit"]):
        return "python"
    if any(k in text for k in ["machine learning", "deep learning", "tensorflow", "pytorch", "ml"]):
        return "data_science"
    if any(k in text for k in ["data science", "statistics", "analytics", "tableau"]):
        return "data_science"
    if any(k in text for k in ["html", "css", "javascript", "react", "frontend", "web design"]):
        return "frontend"
    if any(k in text for k in ["backend", "node", "django", "flask", "api"]):
        return "backend"
    if any(k in text for k in ["sql", "database", "mysql", "postgres"]):
        return "sql"
    if any(k in text for k in ["devops", "docker", "kubernetes", "cloud", "aws"]):
        return "devops"
    if any(k in text for k in ["design", "figma", "ux", "ui", "user experience"]):
        return "uiux_design"
    if any(k in text for k in ["marketing", "seo", "social media", "content"]):
        return "digital_marketing"
    if any(k in text for k in ["language", "english", "ielts", "spanish", "french"]):
        return "language_learning"
    return "general"


def coursera_csv_to_documents(csv_path: pathlib.Path) -> list[dict]:
    """
    Convert a Coursera-style Kaggle CSV into standard document dicts.
    Handles multiple column naming conventions flexibly.
    """
    documents = []
    try:
        with open(csv_path, encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        print(f"  [WARN] Could not read {csv_path}: {e}")
        return []

    print(f"  [csv] {csv_path.name}: {len(rows)} rows")

    for row in rows:
        name = (row.get("Course Name") or row.get("name") or
                row.get("title") or row.get("course_title") or "").strip()
        desc = (row.get("Course Description") or row.get("description") or
                row.get("about") or "").strip()
        skills = (row.get("Skills") or row.get("skills") or "").strip()
        difficulty = (row.get("Difficulty Level") or row.get("level") or "").strip()
        url = (row.get("Course URL") or row.get("url") or "").strip()
        university = (row.get("University") or row.get("institution") or "").strip()

        if not name or not desc:
            continue

        parts = [f"Course: {name}"]
        if university:
            parts.append(f"Provider: {university}")
        if difficulty:
            parts.append(f"Level: {difficulty}")
        if desc:
            parts.append(f"Description: {desc}")
        if skills:
            parts.append(f"Skills covered: {skills}")

        documents.append({
            "source":       "kaggle",
            "domain":       infer_domain(name + " " + skills),
            "roadmap":      name,
            "topic":        name,
            "url":          url,
            "content":      " | ".join(parts),
            "content_type": "course_metadata",
            "difficulty":   difficulty.lower() if difficulty else "",
        })

    return documents


def load_all_kaggle_csvs() -> list[dict]:
    """Load all CSVs from data/raw/kaggle/ recursively."""
    all_docs = []

    if not KAGGLE_DIR.exists():
        print(f"[kaggle] {KAGGLE_DIR} not found — no CSVs to load.")
        return []

    csv_files = list(KAGGLE_DIR.rglob("*.csv"))
    if not csv_files:
        print(f"[kaggle] No CSV files found in {KAGGLE_DIR}")
        return []

    for csv_path in csv_files:
        print(f"\n[kaggle] Processing: {csv_path.name}")
        docs = coursera_csv_to_documents(csv_path)
        print(f"  → {len(docs)} documents")
        all_docs.extend(docs)

    return all_docs


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    KAGGLE_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("Kaggle Data Loader")
    print("=" * 60)

    print("\n[step 1] Attempting Kaggle API download ...")
    api_success = download_via_kaggle_api()

    if not api_success:
        print(f"\n  Manually place CSV files in: {KAGGLE_DIR.resolve()}")
        print(f"  Recommended datasets to download manually:")
        print(f"  → https://www.kaggle.com/datasets/nikhilmittal/coursera-course-dataset-v2")
        print(f"  → https://www.kaggle.com/datasets/siddharthm1/coursera-dataset")
        print(f"  Unzip and drop the CSV files into data/raw/kaggle/")

    print("\n[step 2] Loading CSV files ...")
    docs = load_all_kaggle_csvs()

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(docs)} documents → {OUTPUT_PATH}")

    if docs:
        print("\n[sample]")
        for k, v in docs[0].items():
            print(f"  {k}: {str(v)[:80]}")