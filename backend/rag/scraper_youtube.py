"""
scraper_youtube.py
------------------
Fetches transcripts from curated YouTube videos using youtube-transcript-api.
No YouTube Data API key needed — transcripts are fetched directly.

Output: data/raw/youtube_raw.json

Requires:
    pip install youtube-transcript-api
"""

import json
import time
import pathlib

try:
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
    YT_AVAILABLE = True
except ImportError:
    YT_AVAILABLE = False
    print("[youtube] Run: pip install youtube-transcript-api")


# ── Target videos ─────────────────────────────────────────────────────────────
# Format: (video_id, topic, domain, difficulty)
# video_id = the part after ?v= in the YouTube URL

TARGET_VIDEOS = [
    # Frontend / Web Dev
    ("PkZNo7MFNFg", "JavaScript Full Course for Beginners",         "javascript",    "beginner"),
    ("G3e-cpL7ofc", "HTML & CSS Full Course",                       "frontend",      "beginner"),
    ("Tn6-PIqc4UM", "React Course for Beginners",                   "frontend",      "beginner"),
    ("nu_pCVPKzTk", "CSS Flexbox Tutorial",                         "frontend",      "beginner"),
    ("EerdGm-ehJQ", "Git and GitHub for Beginners",                 "git",           "beginner"),

    # Backend / DevOps
    ("WbRRWrqnxco", "Node.js and Express Tutorial",                 "backend",       "intermediate"),
    ("XCZWyN9ZbEQ", "Docker Tutorial for Beginners",                "devops",        "beginner"),
    ("rfscVS0vtbw", "Learn SQL in 60 minutes",                      "sql",           "beginner"),

    # Python / Data Science
    ("_uQrJ0TkZlc", "Python Tutorial for Beginners Full Course",    "python",        "beginner"),
    ("ua-CiDNNj30", "Machine Learning for Everybody",               "data_science",  "beginner"),
    ("r-uOLxNrNk8", "Data Analysis with Python",                    "data_science",  "intermediate"),

    # UI/UX
    ("c9Wg6Cb_YlU", "UI UX Design Tutorial for Beginners",          "uiux_design",   "beginner"),

    # CS Fundamentals
    ("8hly31xKli0", "Data Structures Easy to Advanced Course",      "dsa",           "intermediate"),
    ("HtSuA80QTyo", "Algorithms and Data Structures Tutorial",      "dsa",           "beginner"),

    # Non-tech
    ("JnA8GUtXpXY", "IELTS Speaking Full Preparation",              "ielts_preparation", "beginner"),
]

DELAY = 1.5


def fetch_transcript(video_id: str) -> str | None:
    """
    Fetch the full transcript for a YouTube video.
    Tries English first, then any available language.
    Returns the full transcript as a single string, or None if unavailable.
    """
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])
    except NoTranscriptFound:
        try:
            # Try any available transcript
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            transcript = next(iter(transcript_list))
            transcript_list = transcript.fetch()
        except Exception:
            return None
    except TranscriptsDisabled:
        return None
    except Exception:
        return None

    # Join all text segments into one string
    full_text = " ".join(
        segment.get("text", "").replace("\n", " ")
        for segment in transcript_list
    )
    return full_text.strip()


def scrape_all_videos() -> list[dict]:
    if not YT_AVAILABLE:
        print("[youtube] youtube-transcript-api not installed. Returning empty list.")
        return []

    documents = []

    print(f"[youtube] Fetching transcripts for {len(TARGET_VIDEOS)} videos ...\n")

    for video_id, topic, domain, difficulty in TARGET_VIDEOS:
        url = f"https://www.youtube.com/watch?v={video_id}"
        print(f"  {topic[:55]}")

        transcript = fetch_transcript(video_id)

        if not transcript or len(transcript) < 200:
            print(f"    → no transcript available, skipping")
            time.sleep(DELAY)
            continue

        documents.append({
            "source":       "youtube",
            "domain":       domain,
            "roadmap":      topic,
            "topic":        topic,
            "url":          url,
            "content":      transcript[:12000],   # cap at ~3000 tokens
            "content_type": "video_transcript",
            "difficulty":   difficulty,
            "video_id":     video_id,
        })

        print(f"    → {len(transcript):,} chars ✓")
        time.sleep(DELAY)

    print(f"\n[youtube] Done. {len(documents)}/{len(TARGET_VIDEOS)} transcripts collected.")
    return documents


if __name__ == "__main__":
    output_path = pathlib.Path("data/raw/youtube_raw.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docs = scrape_all_videos()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(docs)} documents → {output_path}")