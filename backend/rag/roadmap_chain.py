"""
roadmap_chain.py
----------------
Groq + LangChain. Generates a roadmap as a flat JSON array of node objects.
Model: llama-3.3-70b-versatile (handles long structured JSON far better than 8b).
"""
import os, sys, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(dotenv_path=ROOT / "backend" / ".env")

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

try:
    from backend.rag.rag_pipeline import retrieve_context
except ImportError:
    try:
        sys.path.insert(0, str(ROOT / "backend" / "rag"))
        from rag_pipeline import retrieve_context
    except ImportError:
        retrieve_context = None

# Module-level LLM used only for chat (roadmap generation creates its own with dynamic tokens)
_CHAT_LLM = ChatGroq(
    model="llama-3.3-70b-versatile",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.7,
    max_tokens=4096,
)


# ── Timeframe parsing ─────────────────────────────────────────────────────────

def parse_timeframe_to_days(timeframe_str: str) -> float:
    timeframe_str = timeframe_str.lower().strip()
    match = re.search(r'(\d+(?:\.\d+)?)\s*(hour|day|week|month|year)s?', timeframe_str)
    if not match:
        return 30
    value, unit = float(match.group(1)), match.group(2)
    return value * {'hour': 1/24, 'day': 1, 'week': 7, 'month': 30, 'year': 365}[unit]


def classify_goal(goal: str) -> str:
    g = goal.lower()
    exam_kws    = ['exam', 'test', 'ielts', 'toefl', 'gre', 'gmat', 'sat', 'act',
                   'certification', 'certificate', 'certify', 'score', 'band', 'pass']
    project_kws = ['build', 'create', 'develop', 'make', 'app', 'application',
                   'website', 'portfolio', 'deploy', 'launch', 'project', 'system']
    if any(k in g for k in exam_kws):
        return 'exam'
    if any(k in g for k in project_kws):
        return 'project'
    return 'skill'


def calculate_node_count(timeframe_str: str, goal_type: str = 'skill') -> tuple:
    """Return (total_nodes, num_main_nodes, num_checkpoints, num_bonus_nodes).

    Scale per spec:
      hours–2 days  → 3–5 nodes
      3 days–1 week → 5–8 nodes
      2–4 weeks     → 8–12 nodes
      1–3 months    → 12–20 nodes
      3+ months     → 20–35 nodes
    """
    days = parse_timeframe_to_days(timeframe_str)

    if days < 1:        # a few hours
        main, cp, bonus = 3, 0, 0
    elif days <= 2:     # 1–2 days
        main, cp, bonus = 4, 0, 1
    elif days <= 7:     # 3 days – 1 week
        main, cp, bonus = 5, 1, 0
    elif days <= 30:    # 2–4 weeks / ~1 month
        main, cp, bonus = 9, 2, 1
    elif days <= 90:    # 1–3 months
        main, cp, bonus = 14, 3, 1
    elif days <= 180:   # 3–6 months
        main, cp, bonus = 18, 4, 2
    else:               # 6+ months / 1 year
        main, cp, bonus = 22, 5, 3

    if goal_type == 'exam':
        # Swap one bonus for an extra checkpoint (more quiz milestones)
        if bonus > 0:
            bonus -= 1
            cp    += 1
    elif goal_type == 'project':
        main += 1  # one extra hands-on deliverable node

    return (main + cp + bonus, main, cp, bonus)


# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are Roadmapify, an expert personalized learning roadmap generator.

Context from knowledge base:
{context}

Your task: generate a complete learning roadmap as a raw JSON array of node objects.

NODE SCHEMA — every object in the array must have ALL of these fields:
{{
  "id":             "node_1",
  "type":           "main",
  "title":          "3-7 words, SPECIFIC to the goal",
  "description":    "1-2 sentences, specific to this step",
  "emoji":          "one relevant emoji",
  "duration_label": "proportional slice of the total timeframe",
  "xp_reward":      100,
  "status":         "active or locked",
  "steps":          ["concrete instruction 1", "..."],
  "resources":      [{{"label":"...","url":"https://...","tip":"..."}}],
  "quiz_questions": [{{"question":"...","options":["A","B","C","D"],"correct_index":0}}]
}}

STRICT RULES:
1. Generate EXACTLY {total_nodes} nodes: {num_main_nodes} main + {num_checkpoints} checkpoint + {num_bonus_nodes} bonus.
2. First node status = "active". Every other node status = "locked".
3. Place each checkpoint node at roughly 25% intervals through the list.
   Each checkpoint needs 3–5 quiz_questions testing what was just covered. steps=[] resources=[].
4. Bonus node(s) go at the very end as stretch challenges.
5. EVERY title and description must be specific to "{goal}".
   These generic titles are FORBIDDEN — using any of them fails the task:
   "Introduction", "Getting Started", "Overview", "Foundation", "Learn the Basics",
   "Core Skills", "Advanced Topics", "Conclusion", "Recap", "Continue Building",
   "Next Steps", "Final Thoughts", "Wrap Up".
6. Distribute {time_commitment} across all nodes proportionally.
   duration_label must reflect the real calendar position (e.g. "Week 1", "Month 2–3").
7. steps: 3–5 concrete how-to instructions for main/bonus nodes. Empty array [] for checkpoints.
8. resources: 1–2 real https:// URLs for main/bonus nodes. Empty array [] for checkpoints.
9. Do NOT write "..." as a shortcut. Every node must be written out in full.

Return only a raw JSON array. No explanation, no markdown, no code fences, no preamble.
The first character of your response must be [ and the last must be ].\
"""

USER_PROMPT = """\
Generate the learning roadmap for:

Goal: {goal}
Current level: {difficulty}
Total timeframe: {time_commitment}

Node breakdown to generate:
  Total: {total_nodes}
  Main:  {num_main_nodes}
  Checkpoints: {num_checkpoints}
  Bonus: {num_bonus_nodes}

Every single title and description must be specific to "{goal}".
Do NOT produce generic node titles. Every node must be tailored to this exact goal.
Spread {time_commitment} proportionally — do not compress everything into "Week 1–2".
Write all {total_nodes} nodes in full. Do not skip or abbreviate any.

Return only a raw JSON array. No explanation, no markdown, no code fences, no preamble.
The first character of your response must be [ and the last must be ].\
"""

RETRY_SUFFIX = (
    "\n\nIMPORTANT: Your previous response was not a valid JSON array. "
    "Return ONLY the JSON array — nothing else. "
    "Start with [ and end with ]. No markdown, no explanation, no code fences."
)


# ── Parser ────────────────────────────────────────────────────────────────────

def _parse_nodes(raw: str) -> list:
    """Strip fences, parse full response as JSON array, validate length."""
    print(f"\n{'='*60}\n[RAW LLM RESPONSE]\n{raw}\n[END RAW]\n{'='*60}\n")

    cleaned = raw.strip()
    # Strip opening fence (```json or ```)
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned, flags=re.IGNORECASE)
    # Strip closing fence
    cleaned = re.sub(r'\s*```\s*$', '', cleaned).strip()

    parsed = json.loads(cleaned)
    if not isinstance(parsed, list):
        raise ValueError(f"LLM returned {type(parsed).__name__}, expected a JSON array")
    if len(parsed) < 3:
        raise ValueError(f"Only {len(parsed)} nodes returned — minimum is 3")
    return parsed


# ── Generation ────────────────────────────────────────────────────────────────

def _call_llm(
    context_text: str,
    goal: str,
    difficulty: str,
    time_commitment: str,
    total_nodes: int,
    num_main_nodes: int,
    num_checkpoints: int,
    num_bonus_nodes: int,
    is_retry: bool = False,
) -> list:
    # At least 4096; ~400 tokens per node + 1500 overhead; cap at 8192
    max_tokens = max(4096, min(8192, total_nodes * 400 + 1500))

    gen_llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.7,
        max_tokens=max_tokens,
    )

    user_text = USER_PROMPT + (RETRY_SUFFIX if is_retry else "")
    prompt    = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human",  user_text),
    ])

    response = (prompt | gen_llm).invoke({
        "context":         context_text,
        "goal":            goal,
        "difficulty":      difficulty,
        "time_commitment": time_commitment,
        "total_nodes":     total_nodes,
        "num_main_nodes":  num_main_nodes,
        "num_checkpoints": num_checkpoints,
        "num_bonus_nodes": num_bonus_nodes,
    })

    return _parse_nodes(response.content)


def _sanitize_urls(nodes: list) -> list:
    BAD = ["example.com", "placeholder", "N/A", "http://", "https://url", "[real-url]", "[url]"]
    FALLBACKS = [
        {"label": "freeCodeCamp",     "url": "https://www.freecodecamp.org/learn",  "tip": "Free comprehensive learning"},
        {"label": "MDN Web Docs",     "url": "https://developer.mozilla.org",        "tip": "Official web documentation"},
        {"label": "The Odin Project", "url": "https://www.theodinproject.com",       "tip": "Free full-stack curriculum"},
    ]
    for node in nodes:
        clean = []
        for i, res in enumerate(node.get("resources", [])):
            url = res.get("url", "")
            bad = (not url or not url.startswith("https://")
                   or any(p in url for p in BAD) or len(url) < 16)
            if bad:
                fb  = FALLBACKS[i % len(FALLBACKS)]
                res = {**res, "url": fb["url"],
                       "label": res.get("label") or fb["label"],
                       "tip":   res.get("tip")   or fb["tip"]}
            clean.append(res)
        node["resources"] = clean
    return nodes


# ── Public API ────────────────────────────────────────────────────────────────

def generate_roadmap(goal: str, difficulty: str = "beginner", time_commitment: str = "1 month") -> dict:
    # RAG context
    context_text = "No additional context available — use general knowledge."
    if retrieve_context is not None:
        try:
            docs = retrieve_context(f"{goal} {difficulty}", n_results=5)
            if docs:
                context_text = "\n\n".join(
                    f"[{d.get('source','?')}] {d.get('content', '')[:300]}"
                    for d in docs
                )
        except Exception as e:
            print(f"[RAG] non-fatal: {e}")

    goal_type = classify_goal(goal)
    total_nodes, num_main_nodes, num_checkpoints, num_bonus_nodes = calculate_node_count(
        time_commitment, goal_type
    )
    print(
        f"[generate_roadmap] goal='{goal}' type='{goal_type}' "
        f"timeframe='{time_commitment}' → {total_nodes} nodes "
        f"({num_main_nodes} main, {num_checkpoints} cp, {num_bonus_nodes} bonus)"
    )

    nodes = None

    # Attempt 1
    try:
        nodes = _call_llm(
            context_text, goal, difficulty, time_commitment,
            total_nodes, num_main_nodes, num_checkpoints, num_bonus_nodes,
        )
        print(f"[generate_roadmap] attempt 1: {len(nodes)} nodes — OK")
    except Exception as e:
        print(f"[generate_roadmap] attempt 1 failed: {e}")

    # Attempt 2 — retry with explicit correction
    if nodes is None or len(nodes) < 3:
        print("[generate_roadmap] retrying with correction prompt...")
        try:
            nodes = _call_llm(
                context_text, goal, difficulty, time_commitment,
                total_nodes, num_main_nodes, num_checkpoints, num_bonus_nodes,
                is_retry=True,
            )
            print(f"[generate_roadmap] attempt 2: {len(nodes)} nodes — OK")
        except Exception as e:
            print(f"[generate_roadmap] attempt 2 failed: {e}")
            raise ValueError(
                f"Roadmap generation failed after 2 attempts for goal: {goal!r}. "
                "The AI did not return a valid JSON array."
            )

    # Trim if model returned more than requested
    if len(nodes) > total_nodes:
        print(f"[generate_roadmap] trimming {len(nodes)} → {total_nodes} nodes")
        nodes = nodes[:total_nodes]

    nodes = _sanitize_urls(nodes)

    # Guarantee first node is active, rest locked
    for i, node in enumerate(nodes):
        node["status"] = "active" if i == 0 else "locked"

    total_xp = sum(n.get("xp_reward", 100) for n in nodes)
    return {
        "title":       f"{goal.strip()} Roadmap",
        "description": f"A personalised {time_commitment} learning path for {goal.strip()}.",
        "total_xp":    total_xp,
        "nodes":       nodes,
    }


def chat_with_roadmap(user_message, roadmap_context, current_module, current_resource, chat_history):
    node_ctx = ""
    if current_module:
        steps    = current_module.get("steps", [])
        node_ctx = (
            f"\nCurrently on: {current_module.get('title','')}"
            f"\nDescription: {current_module.get('description','')}"
            f"\nSteps: {json.dumps(steps)}\n"
        )
    res_ctx = ""
    if current_resource:
        res_ctx = (
            f"\nUsing resource: "
            f"{current_resource.get('label', current_resource.get('title',''))} "
            f"— {current_resource.get('url','')}\n"
        )

    goal   = roadmap_context.get("title", roadmap_context.get("goal", "the learning goal"))
    system = (
        f"You are Roadmapify's AI tutor — expert, friendly, specific.\n"
        f"Goal: {goal}\n{node_ctx}{res_ctx}\n"
        f"Give specific, actionable help. Use examples and exact steps when relevant. "
        f"Keep answers concise."
    )

    messages = [("system", system)]
    for m in chat_history[-6:]:
        role = m["role"] if m["role"] in ("human", "assistant", "system") else "human"
        messages.append((role, m["content"]))
    messages.append(("human", user_message))

    try:
        response = (ChatPromptTemplate.from_messages(messages) | _CHAT_LLM).invoke({})
        return response.content.strip()
    except Exception as e:
        print(f"[chat_with_roadmap] LLM error: {e}")
        raise


if __name__ == "__main__":
    import sys as _sys
    goal = _sys.argv[1] if len(_sys.argv) > 1 else "bake a cake"
    tf   = _sys.argv[2] if len(_sys.argv) > 2 else "1 day"
    result = generate_roadmap(goal, "beginner", tf)
    print(json.dumps(result, indent=2))
