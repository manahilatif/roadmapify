"""
scraper_reddit.py
-----------------
Pulls posts and comments from relevant Reddit communities using PRAW.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT: Reddit API access tiers (as of 2023–present)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FREE tier (what you have by default):
  - 100 requests / minute
  - Read-only access to public posts/comments
  - Works with PRAW using script-type credentials
  - No cost — just register an app at reddit.com/prefs/apps
  - Limitation: rate-limited, no pushshift/historical access

PAID tier (Data API):
  - Needed for: bulk historical data, high-volume scraping
  - Costs ~$0.24 per 1000 API calls above free quota
  - Required for: commercial use, large-scale research
  - Sign up: developers.reddit.com

For Roadmapify Phase 2, the FREE tier is more than sufficient.
We just need ~500-1000 posts for the knowledge base.

Setup (free, 5 minutes):
  1. Go to: https://www.reddit.com/prefs/apps
  2. Click "Create App" (or "Create Another App")
  3. Name: roadmapify-scraper
  4. Type: script
  5. Redirect URI: http://localhost:8080
  6. Click "Create app"
  7. Copy:
       - client_id:     the string under the app name (14 chars)
       - client_secret: the "secret" field

  Add to backend/.env:
    REDDIT_CLIENT_ID=your_client_id
    REDDIT_CLIENT_SECRET=your_client_secret
    REDDIT_USER_AGENT=roadmapify-scraper/1.0

Output: data/raw/reddit_raw.json
"""

import os
import json
import time
import pathlib
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

try:
    import praw
    from praw.exceptions import RedditAPIException
    PRAW_AVAILABLE = True
except ImportError:
    PRAW_AVAILABLE = False
    print("[reddit] PRAW not installed. Run: pip install praw")


# ── Config ────────────────────────────────────────────────────────────────────

REDDIT_CLIENT_ID     = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT    = os.getenv("REDDIT_USER_AGENT", "roadmapify-scraper/1.0 by roadmapify")

# Posts to fetch per subreddit per search query
POSTS_PER_QUERY  = 10
# Top comments to fetch per post (free tier: keep this low)
COMMENTS_PER_POST = 3
# Delay between API calls (free tier: 100 req/min → 0.6s minimum, use 1.0s to be safe)
DELAY = 1.2

OUTPUT_PATH = pathlib.Path("data/raw/reddit_raw.json")


# ── Subreddit + query targets ─────────────────────────────────────────────────
# Format: (subreddit, search_query, domain_tag, roadmap_tag)

TARGETS = [
    # ── Programming / Tech ──────────────────────────────────────────────────
    ("learnprogramming", "how to start web development roadmap",     "frontend",         "Frontend Development"),
    ("learnprogramming", "python beginner learning path resources",   "python",           "Python"),
    ("learnprogramming", "data structures algorithms study guide",    "dsa",              "DSA"),
    ("learnprogramming", "javascript learning resources tutorial",    "javascript",       "JavaScript"),
    ("learnprogramming", "machine learning beginner resources",       "data_science",     "Machine Learning"),
    ("webdev",           "react learning resources projects",         "frontend",         "React"),
    ("webdev",           "backend development roadmap node django",   "backend",          "Backend Development"),
    ("webdev",           "fullstack developer roadmap 2024",          "full-stack",       "Full Stack"),
    ("devops",           "devops learning path docker kubernetes",    "devops",           "DevOps"),
    ("learnpython",      "python projects for beginners",             "python",           "Python Projects"),
    ("cscareerquestions","software engineer learning roadmap",        "computer_science", "Software Engineering"),
    ("datascience",      "data science beginner roadmap resources",   "data_science",     "Data Science"),

    # ── Non-tech domains ─────────────────────────────────────────────────────
    ("IWantToLearn",     "how to learn a new language effectively",   "language_learning","Language Learning"),
    ("IWantToLearn",     "how to start learning to cook",             "cooking",          "Cooking"),
    ("IWantToLearn",     "how to start baking bread pastry",          "baking",           "Baking"),
    ("crochet",          "beginner crochet tips resources guide",     "crochet",          "Crochet"),
    ("Cooking",          "beginner cooking tips learn techniques",    "cooking",          "Cooking Techniques"),
    ("Baking",           "beginner baking guide resources tips",      "baking",           "Baking Guide"),
    ("IELTSgeneral",     "IELTS preparation tips resources plan",     "ielts_preparation","IELTS Preparation"),
    ("learndesign",      "UX UI design learning path resources",      "uiux_design",      "UI/UX Design"),
    ("marketing",        "digital marketing learning path beginner",  "digital_marketing","Digital Marketing"),
]


# ── Reddit client factory ─────────────────────────────────────────────────────

def get_reddit_client():
    """
    Returns a PRAW Reddit read-only client.

    If credentials are not set, returns None — the scraper
    will generate an empty output file without crashing.
    """
    if not PRAW_AVAILABLE:
        return None

    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        print("[reddit] Credentials not set in backend/.env")
        print("  REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET are required.")
        print("  See setup instructions at the top of this file.")
        return None

    try:
        reddit = praw.Reddit(
            client_id=REDDIT_CLIENT_ID,
            client_secret=REDDIT_CLIENT_SECRET,
            user_agent=REDDIT_USER_AGENT,
            # read_only=True is implicit when no username/password is given
        )
        # Quick connectivity test
        _ = reddit.subreddit("learnprogramming").id
        print("[reddit] ✓ Connected to Reddit API (read-only, free tier)")
        return reddit

    except Exception as e:
        print(f"[reddit] Connection failed: {e}")
        print("  Check your REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in backend/.env")
        return None


# ── Scraping helpers ──────────────────────────────────────────────────────────

def clean(text: str) -> str:
    return " ".join(text.split()).strip() if text else ""


def is_valid_post(post) -> bool:
    """Filter out deleted/removed/low-quality posts."""
    if not post.selftext or post.selftext in ("[deleted]", "[removed]", ""):
        return False
    if post.score < 5:      # skip very low-karma posts
        return False
    if len(post.selftext) < 100:
        return False
    return True


def post_to_document(post, domain: str, roadmap: str, subreddit: str) -> dict:
    """Convert a PRAW post object to a document dict."""
    title   = clean(post.title)
    body    = clean(post.selftext)
    content = f"Post: {title} | {body}"

    return {
        "source":       "reddit",
        "domain":       domain,
        "roadmap":      roadmap,
        "topic":        title,
        "url":          f"https://reddit.com{post.permalink}",
        "content":      content[:4000],
        "content_type": "community_qa",
        "subreddit":    subreddit,
        "score":        post.score,
    }


def fetch_top_comments(post, n: int = COMMENTS_PER_POST) -> str:
    """
    Fetch top N comments from a post and join them as a string.
    Uses .comments.list() to avoid extra API calls for CommentForest.
    """
    try:
        post.comments.replace_more(limit=0)   # don't expand MoreComments (saves API calls)
        comments = []
        for comment in post.comments.list()[:n]:
            if hasattr(comment, "body"):
                t = clean(comment.body)
                if t and t not in ("[deleted]", "[removed]") and len(t) > 30:
                    comments.append(t)
        return " | ".join(comments)
    except Exception:
        return ""


def scrape_subreddit(reddit, subreddit_name: str, query: str,
                     domain: str, roadmap: str, limit: int = POSTS_PER_QUERY) -> list[dict]:
    """
    Search a subreddit for a query and return document dicts.
    Falls back to hot posts if search returns nothing.
    """
    documents = []
    seen_ids  = set()

    try:
        subreddit = reddit.subreddit(subreddit_name)

        # Primary: search
        results = list(subreddit.search(query, sort="relevance", limit=limit))

        # Fallback: hot posts if search came up empty
        if not results:
            results = list(subreddit.hot(limit=limit))

        for post in results:
            if post.id in seen_ids:
                continue
            seen_ids.add(post.id)

            if not is_valid_post(post):
                continue

            doc = post_to_document(post, domain, roadmap, subreddit_name)

            # Optionally append top comments to content
            comments = fetch_top_comments(post)
            if comments:
                doc["content"] = f"{doc['content']} | Comments: {comments}"
                doc["content"] = doc["content"][:5000]

            documents.append(doc)
            time.sleep(DELAY)

    except RedditAPIException as e:
        print(f"  [API ERROR] r/{subreddit_name}: {e}")
        # Paid tier upgrade note:
        # If you see 429 (Too Many Requests), you've hit the free tier limit.
        # Either wait 60 seconds or upgrade at developers.reddit.com
    except Exception as e:
        print(f"  [ERROR] r/{subreddit_name}: {e}")

    return documents


# ── Master runner ─────────────────────────────────────────────────────────────

def scrape_all_reddit() -> list[dict]:
    """
    Run all configured subreddit searches.

    If Reddit credentials are not configured:
      - Prints clear setup instructions
      - Returns empty list (does NOT crash)
      - Saves empty JSON file so chunker/embedder pipeline still works

    To upgrade to paid tier later:
      - No code changes needed
      - Just increase POSTS_PER_QUERY and COMMENTS_PER_POST
      - Remove the score >= 5 filter in is_valid_post() for more data
    """
    reddit = get_reddit_client()

    if reddit is None:
        print("\n[reddit] Skipping scrape — no valid credentials.")
        print("  The rest of your pipeline will work fine without Reddit data.")
        print("  Add credentials to backend/.env when ready and re-run.")
        return []

    all_docs = []
    seen_urls = set()

    print(f"\n[reddit] Scraping {len(TARGETS)} subreddit/query pairs ...")
    print(f"  Posts per query: {POSTS_PER_QUERY}")
    print(f"  Comments per post: {COMMENTS_PER_POST}")
    print(f"  Estimated time: ~{len(TARGETS) * POSTS_PER_QUERY * DELAY / 60:.1f} minutes\n")

    for i, (subreddit, query, domain, roadmap) in enumerate(TARGETS):
        print(f"[{i+1}/{len(TARGETS)}] r/{subreddit}: {query[:50]}")

        docs = scrape_subreddit(reddit, subreddit, query, domain, roadmap)

        # Deduplicate by URL
        new_docs = [d for d in docs if d["url"] not in seen_urls]
        seen_urls.update(d["url"] for d in new_docs)

        all_docs.extend(new_docs)
        print(f"  → {len(new_docs)} new documents ({len(all_docs)} total)")

    print(f"\n[reddit] Done. {len(all_docs)} documents collected.")
    return all_docs


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    docs = scrape_all_reddit()

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {len(docs)} documents → {OUTPUT_PATH}")

    if docs:
        print("\n[sample]")
        for k, v in docs[0].items():
            print(f"  {k}: {str(v)[:80]}")
    else:
        print("\n[note] Empty file saved. Run again after adding Reddit credentials.")
        print("  Your pipeline (chunker.py, embedder.py) will handle this gracefully.")