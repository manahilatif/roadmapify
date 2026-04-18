"""
scraper_onet_and_datasets.py
-----------------------------
Handles three external data sources:

1. O*NET Database (onetcenter.org/database.html)
   - Occupational skill requirements for 900+ jobs
   - Maps job titles → required skills → learning topics
   - Why: grounds our non-tech roadmaps (digital marketing, design, etc.)
     in real occupational skill data

2. Google Drive shared datasets
   - https://share.google/PFNzxy5jmZthbu8xw
   - https://share.google/p4PY43mCHZRyWynfC
   - Downloaded manually (Drive links can't be scraped without auth)
   - This script processes whatever CSV/JSON files you drop in data/raw/gdrive/

3. GitHub — kamranahmedse/developer-roadmap
   - https://github.com/kamranahmedse/developer-roadmap
   - The community developer roadmap repo
   - We pull README content and any JSON data files via GitHub API

Output:
  data/raw/onet_raw.json
  data/raw/gdrive_raw.json
  data/raw/github_roadmap_raw.json
"""

import os
import json
import csv
import time
import pathlib
import zipfile
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
DELAY = 2.0


# ══════════════════════════════════════════════════════════════════════════════
# 1. O*NET Database
# ══════════════════════════════════════════════════════════════════════════════

ONET_DB_PAGE = "https://www.onetcenter.org/database.html"
ONET_DIR     = pathlib.Path("data/raw/onet")

# O*NET file names we care about (from their database ZIP)
# These are available for free download — no API key needed
ONET_FILES_OF_INTEREST = [
    "Occupation Data.txt",          # job titles + descriptions
    "Skills.txt",                    # skill requirements per occupation
    "Knowledge.txt",                 # knowledge requirements
    "Abilities.txt",                 # ability requirements
    "Technology Skills.txt",         # specific tech tools per job
]

# Job families relevant to our domains
RELEVANT_SOC_PREFIXES = [
    "11-",  # Management
    "13-",  # Business & Financial
    "15-",  # Computer & Mathematical  ← most important for us
    "17-",  # Architecture & Engineering
    "25-",  # Education
    "27-",  # Arts, Design, Media      ← UI/UX, digital marketing
    "41-",  # Sales
    "43-",  # Office & Admin
]


def get_onet_download_url() -> str | None:
    """
    Scrape the O*NET database page to find the latest database download URL.
    The version number changes periodically (e.g., 28.3, 29.0).
    """
    print(f"[onet] Checking {ONET_DB_PAGE} for download link ...")
    try:
        resp = requests.get(ONET_DB_PAGE, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Find the database ZIP download link
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if "db_" in href and href.endswith(".zip"):
                if href.startswith("http"):
                    return href
                return f"https://www.onetcenter.org{href}"

        print("[onet] Could not find ZIP link automatically.")
        print("  Go to https://www.onetcenter.org/database.html")
        print("  Download the 'All Files' ZIP and place it in data/raw/onet/")
        return None

    except Exception as e:
        print(f"[onet] Page scrape failed: {e}")
        return None


def download_onet_db() -> bool:
    """Download and extract the O*NET database ZIP."""
    ONET_DIR.mkdir(parents=True, exist_ok=True)

    # Check if already downloaded
    existing = list(ONET_DIR.glob("*.txt"))
    if len(existing) >= 3:
        print(f"[onet] Already have {len(existing)} files in {ONET_DIR}, skipping download.")
        return True

    url = get_onet_download_url()
    if not url:
        return False

    zip_path = ONET_DIR / "onet_db.zip"
    print(f"[onet] Downloading database: {url}")
    print(f"  (This is a large file ~150MB, may take a few minutes)")

    try:
        resp = requests.get(url, headers=HEADERS, timeout=120, stream=True)
        resp.raise_for_status()

        total = int(resp.headers.get("Content-Length", 0))
        downloaded = 0

        with open(zip_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded / total * 100
                    print(f"  {pct:.0f}%  ({downloaded // 1024 // 1024}MB / {total // 1024 // 1024}MB)", end="\r")

        print(f"\n[onet] Download complete. Extracting ...")

        with zipfile.ZipFile(zip_path, "r") as zf:
            for name in zf.namelist():
                # Only extract files we care about
                basename = pathlib.Path(name).name
                if any(basename == f for f in ONET_FILES_OF_INTEREST):
                    zf.extract(name, ONET_DIR)
                    print(f"  Extracted: {basename}")

        zip_path.unlink()   # delete ZIP to save space
        print("[onet] Extraction complete.")
        return True

    except Exception as e:
        print(f"[onet] Download/extract failed: {e}")
        print("  Manual fallback:")
        print("  1. Go to https://www.onetcenter.org/database.html")
        print("  2. Download 'All Files' ZIP")
        print(f"  3. Extract these files to {ONET_DIR.resolve()}:")
        for f in ONET_FILES_OF_INTEREST:
            print(f"     - {f}")
        return False


def parse_onet_txt(file_path: pathlib.Path) -> list[dict]:
    """
    O*NET text files are tab-separated with a header row.
    Each row = one skill/knowledge requirement for one occupation.
    """
    rows = []
    try:
        with open(file_path, encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                rows.append(dict(row))
    except Exception as e:
        print(f"  [WARN] Could not parse {file_path.name}: {e}")
    return rows


def onet_to_documents() -> list[dict]:
    """
    Convert O*NET data files into document dicts for the knowledge base.

    Strategy:
    - Group by occupation (O*NET-SOC Code)
    - Combine title + description + skills into one document per occupation
    - Filter to relevant occupational families
    """
    documents = []

    # Find files (they may be nested in a subdirectory after extraction)
    def find_file(name):
        for p in ONET_DIR.rglob(name):
            return p
        return None

    # Load occupation descriptions
    occ_file = find_file("Occupation Data.txt")
    occ_map = {}   # soc_code → {title, description}
    if occ_file:
        for row in parse_onet_txt(occ_file):
            code  = row.get("O*NET-SOC Code", "")
            title = row.get("Title", "")
            desc  = row.get("Description", "")
            if code:
                occ_map[code] = {"title": title, "description": desc}
    print(f"[onet] Loaded {len(occ_map)} occupations")

    # Load skills
    skills_file = find_file("Skills.txt")
    skills_map = {}   # soc_code → list of skill names
    if skills_file:
        for row in parse_onet_txt(skills_file):
            code  = row.get("O*NET-SOC Code", "")
            skill = row.get("Element Name", "")
            level = float(row.get("Data Value", 0) or 0)
            if code and skill and level >= 3.0:   # only meaningful skills (scale 1-7)
                skills_map.setdefault(code, []).append(skill)

    # Load tech skills
    tech_file = find_file("Technology Skills.txt")
    tech_map = {}
    if tech_file:
        for row in parse_onet_txt(tech_file):
            code = row.get("O*NET-SOC Code", "")
            tech = row.get("Example", "") or row.get("Commodity Title", "")
            if code and tech:
                tech_map.setdefault(code, []).append(tech)

    # Build documents — one per occupation, filtered to relevant families
    for code, occ in occ_map.items():
        # Filter to relevant SOC families
        prefix = code[:3] + "-"
        if not any(code.startswith(p) for p in RELEVANT_SOC_PREFIXES):
            continue

        title = occ.get("title", "")
        desc  = occ.get("description", "")
        skills = skills_map.get(code, [])
        techs  = tech_map.get(code, [])

        if not title or not desc:
            continue

        parts = [f"Job: {title}", f"Description: {desc}"]
        if skills:
            parts.append(f"Required skills: {', '.join(skills[:15])}")
        if techs:
            parts.append(f"Tools & technologies: {', '.join(techs[:10])}")

        # Infer domain from job title
        domain = infer_domain_from_job(title)

        documents.append({
            "source":       "onet",
            "domain":       domain,
            "roadmap":      title,
            "topic":        title,
            "url":          f"https://www.onetonline.org/link/summary/{code}",
            "content":      " | ".join(parts),
            "content_type": "occupational_data",
            "onet_code":    code,
        })

    print(f"[onet] Built {len(documents)} occupation documents")
    return documents


def infer_domain_from_job(title: str) -> str:
    t = title.lower()
    if any(k in t for k in ["software", "developer", "programmer", "engineer"]):
        return "computer_science"
    if any(k in t for k in ["data scientist", "data analyst", "machine learning"]):
        return "data_science"
    if any(k in t for k in ["web developer", "front-end", "frontend", "ui developer"]):
        return "frontend"
    if any(k in t for k in ["database", "sql", "dba"]):
        return "sql"
    if any(k in t for k in ["ux", "ui", "user experience", "graphic design", "art director"]):
        return "uiux_design"
    if any(k in t for k in ["marketing", "seo", "social media", "content"]):
        return "digital_marketing"
    if any(k in t for k in ["teacher", "instructor", "trainer", "educator"]):
        return "general"
    return "general"


# ══════════════════════════════════════════════════════════════════════════════
# 2. Google Drive shared datasets
# ══════════════════════════════════════════════════════════════════════════════

GDRIVE_DIR = pathlib.Path("data/raw/gdrive")

GDRIVE_LINKS = [
    "https://share.google/PFNzxy5jmZthbu8xw",
    "https://share.google/p4PY43mCHZRyWynfC",
]


def load_gdrive_files() -> list[dict]:
    """
    Process files manually downloaded from the Google Drive links.

    Google Drive shared links cannot be downloaded programmatically without
    OAuth credentials. You need to:
      1. Open each link in your browser
      2. Download the file(s)
      3. Place them in data/raw/gdrive/
      4. Re-run this script

    Supported formats: CSV, JSON
    """
    GDRIVE_DIR.mkdir(parents=True, exist_ok=True)
    documents = []

    files = list(GDRIVE_DIR.glob("*.csv")) + list(GDRIVE_DIR.glob("*.json"))

    if not files:
        print("[gdrive] No files found in data/raw/gdrive/")
        print("  Manually download from these links and place files in that folder:")
        for link in GDRIVE_LINKS:
            print(f"  → {link}")
        return []

    for file_path in files:
        print(f"[gdrive] Processing: {file_path.name}")

        if file_path.suffix == ".csv":
            docs = generic_csv_to_documents(file_path, source="gdrive")
        elif file_path.suffix == ".json":
            docs = generic_json_to_documents(file_path, source="gdrive")
        else:
            docs = []

        print(f"  → {len(docs)} documents")
        documents.extend(docs)

    return documents


def generic_csv_to_documents(csv_path: pathlib.Path, source: str) -> list[dict]:
    """Convert any CSV with text content to documents. Best-effort."""
    documents = []
    try:
        with open(csv_path, encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Find the longest text column as content
                content_col = max(row, key=lambda k: len(str(row.get(k, ""))))
                content = str(row.get(content_col, "")).strip()
                title_col = next((k for k in row if "title" in k.lower() or "name" in k.lower()), content_col)
                title = str(row.get(title_col, "")).strip()[:100]

                if content and len(content) > 50:
                    documents.append({
                        "source":       source,
                        "domain":       "general",
                        "roadmap":      csv_path.stem,
                        "topic":        title or csv_path.stem,
                        "url":          "",
                        "content":      content[:4000],
                        "content_type": "dataset",
                    })
    except Exception as e:
        print(f"  [WARN] {e}")
    return documents


def generic_json_to_documents(json_path: pathlib.Path, source: str) -> list[dict]:
    """Convert a JSON file to documents."""
    documents = []
    try:
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = [data]
        else:
            return []

        for item in items:
            if not isinstance(item, dict):
                continue
            content = json.dumps(item, ensure_ascii=False)
            topic = str(item.get("title") or item.get("name") or json_path.stem)[:100]

            if len(content) > 50:
                documents.append({
                    "source":       source,
                    "domain":       "general",
                    "roadmap":      json_path.stem,
                    "topic":        topic,
                    "url":          "",
                    "content":      content[:4000],
                    "content_type": "dataset",
                })
    except Exception as e:
        print(f"  [WARN] {e}")
    return documents


# ══════════════════════════════════════════════════════════════════════════════
# 3. GitHub — kamranahmedse/developer-roadmap
# ══════════════════════════════════════════════════════════════════════════════

GITHUB_API_BASE = "https://api.github.com"
GITHUB_REPO     = "kamranahmedse/developer-roadmap"
GITHUB_TOKEN    = os.getenv("GITHUB_TOKEN", "")   # optional, increases rate limit


def github_headers() -> dict:
    h = {"User-Agent": "roadmapify-scraper/1.0", "Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"token {GITHUB_TOKEN}"
    return h


def fetch_github_readme() -> list[dict]:
    """Fetch the main README of kamranahmedse/developer-roadmap."""
    url = f"{GITHUB_API_BASE}/repos/{GITHUB_REPO}/readme"
    print(f"[github] Fetching README: {GITHUB_REPO}")

    try:
        resp = requests.get(url, headers=github_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()

        import base64
        content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        # Strip markdown formatting somewhat
        lines = [l.strip() for l in content.splitlines() if l.strip()]
        clean_content = " | ".join(lines[:200])   # first 200 lines covers the index

        return [{
            "source":       "github_kamranahmedse",
            "domain":       "general",
            "roadmap":      "Developer Roadmap",
            "topic":        "Developer Roadmap Overview",
            "url":          f"https://github.com/{GITHUB_REPO}",
            "content":      clean_content[:8000],
            "content_type": "roadmap_index",
        }]

    except Exception as e:
        print(f"  [WARN] Could not fetch README: {e}")
        return []


def fetch_github_roadmap_jsons() -> list[dict]:
    """
    Look for JSON data files in the repo that describe roadmap topics.
    The kamranahmedse repo stores roadmap data as JSON in src/data/roadmaps/
    """
    documents = []
    url = f"{GITHUB_API_BASE}/repos/{GITHUB_REPO}/git/trees/master?recursive=1"

    print(f"[github] Fetching file tree ...")

    try:
        resp = requests.get(url, headers=github_headers(), timeout=15)
        resp.raise_for_status()
        tree = resp.json().get("tree", [])

        # Find JSON files in roadmap data directories
        json_files = [
            item for item in tree
            if item["type"] == "blob"
            and item["path"].endswith(".json")
            and ("roadmap" in item["path"].lower() or "data" in item["path"].lower())
        ]

        print(f"  Found {len(json_files)} JSON files")

        # Process up to 20 files (rate limit friendly)
        for item in json_files[:20]:
            path = item["path"]
            raw_url = f"https://raw.githubusercontent.com/{GITHUB_REPO}/master/{path}"

            try:
                r = requests.get(raw_url, headers=github_headers(), timeout=10)
                r.raise_for_status()
                data = r.json()

                # Extract meaningful content from the JSON structure
                content = json.dumps(data, ensure_ascii=False)[:6000]
                topic = pathlib.Path(path).stem.replace("-", " ").replace("_", " ").title()

                documents.append({
                    "source":       "github_kamranahmedse",
                    "domain":       infer_domain_from_path(path),
                    "roadmap":      topic,
                    "topic":        topic,
                    "url":          f"https://github.com/{GITHUB_REPO}/blob/master/{path}",
                    "content":      content,
                    "content_type": "roadmap_data",
                })
                time.sleep(0.5)

            except Exception as e:
                print(f"  [WARN] {path}: {e}")

    except Exception as e:
        print(f"  [WARN] Could not fetch tree: {e}")
        print("  This is OK — GitHub rate limits unauthenticated requests to 60/hour.")
        print("  Add GITHUB_TOKEN=your_token to backend/.env for higher limits.")

    return documents


def infer_domain_from_path(path: str) -> str:
    p = path.lower()
    if "frontend" in p:     return "frontend"
    if "backend" in p:      return "backend"
    if "devops" in p:       return "devops"
    if "python" in p:       return "python"
    if "javascript" in p:   return "javascript"
    if "react" in p:        return "frontend"
    if "android" in p:      return "mobile"
    if "ios" in p:          return "mobile"
    if "data" in p:         return "data_science"
    if "machine" in p:      return "data_science"
    if "system" in p:       return "system_design"
    if "sql" in p:          return "sql"
    if "docker" in p:       return "devops"
    return "computer_science"


# ══════════════════════════════════════════════════════════════════════════════
# Entry points
# ══════════════════════════════════════════════════════════════════════════════

def run_onet():
    output = pathlib.Path("data/raw/onet_raw.json")
    output.parent.mkdir(parents=True, exist_ok=True)

    print("\n" + "="*60)
    print("O*NET Database")
    print("="*60)

    success = download_onet_db()
    if success:
        docs = onet_to_documents()
    else:
        docs = []

    with open(output, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)
    print(f"[saved] {len(docs)} documents → {output}")
    return docs


def run_gdrive():
    output = pathlib.Path("data/raw/gdrive_raw.json")
    output.parent.mkdir(parents=True, exist_ok=True)

    print("\n" + "="*60)
    print("Google Drive Datasets")
    print("="*60)

    docs = load_gdrive_files()

    with open(output, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)
    print(f"[saved] {len(docs)} documents → {output}")
    return docs


def run_github():
    output = pathlib.Path("data/raw/github_roadmap_raw.json")
    output.parent.mkdir(parents=True, exist_ok=True)

    print("\n" + "="*60)
    print("GitHub — kamranahmedse/developer-roadmap")
    print("="*60)

    docs = []
    docs.extend(fetch_github_readme())
    time.sleep(1)
    docs.extend(fetch_github_roadmap_jsons())

    with open(output, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)
    print(f"[saved] {len(docs)} documents → {output}")
    return docs


if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode in ("all", "onet"):
        run_onet()
    if mode in ("all", "gdrive"):
        run_gdrive()
    if mode in ("all", "github"):
        run_github()

    print("\n[done] All selected sources processed.")
    print("Next: python backend/rag/chunker.py && python backend/rag/embedder.py")