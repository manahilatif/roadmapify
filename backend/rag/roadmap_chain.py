"""
roadmap_chain.py
----------------
LangChain + Groq. Generates a nodes[] roadmap where each node is ONE specific task.
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

llm = ChatGroq(
    model="llama-3.1-8b-instant",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.7,
    max_tokens=6000,
)

# ── Timeframe parsing and node count calculation ────────────────────────────

def parse_timeframe_to_days(timeframe_str: str) -> int:
    """Parse a timeframe string and return approximate number of days."""
    timeframe_str = timeframe_str.lower().strip()
    
    # Try to extract number and unit
    match = re.search(r'(\d+)\s*(hour|day|week|month|year)s?', timeframe_str)
    if not match:
        return 30  # default to 1 month if parsing fails
    
    value, unit = int(match.group(1)), match.group(2)
    
    if 'hour' in unit:
        return value / 24
    elif 'day' in unit:
        return value
    elif 'week' in unit:
        return value * 7
    elif 'month' in unit:
        return value * 30
    elif 'year' in unit:
        return value * 365
    
    return 30  # default

def calculate_node_count(timeframe_str: str) -> tuple:
    """Calculate the number of nodes and checkpoints based on timeframe.
    Returns (total_nodes, num_main_nodes, num_checkpoints, num_bonus_nodes)
    """
    days = parse_timeframe_to_days(timeframe_str)
    
    # Scaling rules
    if days < 1:  # Few hours
        return (4, 3, 0, 1)
    elif days <= 7:  # 1-7 days
        return (6, 5, 1, 0)
    elif days <= 14:  # 1-2 weeks
        return (8, 6, 1, 1)
    elif days <= 30:  # 3-4 weeks
        return (12, 9, 2, 1)
    elif days <= 90:  # 2-3 months
        return (18, 14, 2, 2)
    elif days <= 180:  # 4-6 months
        return (26, 20, 3, 3)
    else:  # 6 months or more
        return (32, 24, 4, 4)

# ── Prompts ───────────────────────────────────────────────────────────────────
#
# KEY DESIGN DECISIONS:
#   1. Every placeholder uses [BRACKET] syntax — the model fills these in.
#   2. Node count is NOT hardcoded — passed as {total_nodes} and {num_main_nodes}
#   3. JSON braces are escaped as {{ / }} for LangChain's template engine.
#
SYSTEM_PROMPT = """You are Roadmapify. Return a complete learning roadmap as a JSON object.

Context: {context}

RULES:
1. Output EXACTLY {total_nodes} nodes total: {num_main_nodes} main nodes, {num_checkpoints} checkpoints, and {num_bonus_nodes} bonus nodes
2. First main node (node_1) status "active"; all others status "locked"
3. Main nodes: type "main"; Checkpoint nodes: type "checkpoint"; Bonus nodes: type "bonus"
4. **IMPORTANT**: Insert checkpoint nodes roughly every 25-30% of the way through. Each checkpoint must include a "quiz_questions" array with 3-5 multiple-choice questions.
   Each question: {{"question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0}}
5. Each title must be 3-7 words, SPECIFIC to the learner's goal.
   FORBIDDEN titles: "Getting Started", "Foundation", "Learn basics", "Core Skills", "Introduction", "Overview"
6. Each main node: steps (3-5 concrete how-to instructions) and resources (2 real https:// URLs)
7. Checkpoint nodes: only need title, description, and quiz_questions. No steps or resources required.
8. Distribute the total timeframe proportionally across all nodes. Each node's duration_label should reflect its position in the timeline.
   Example: if timeframe is "3 months" and there are 12 nodes, early nodes ≈ "Week 1", middle nodes ≈ "Week 2-3", later nodes ≈ "Week 3-4"
9. Do NOT use "..." anywhere. Write all {total_nodes} nodes in full.
10. Calculate total_xp as the sum of all node xp_rewards.

Real resource URLs:
https://www.ielts.org | https://ieltsliz.com | https://www.ielts-simon.com
https://www.britishcouncil.org/exam/ielts/ielts-practice-tests
https://www.freecodecamp.org/learn | https://javascript.info
https://developer.mozilla.org | https://docs.python.org/3/tutorial
https://www.kaggle.com/learn | https://git-scm.com/book/en/v2
https://tailwindcss.com/docs | https://docs.docker.com/get-started

Return ONLY valid JSON. Start with {{ and end with }}. No markdown. No text outside the JSON."""

USER_PROMPT = """Generate the roadmap for:

Goal: {goal}
Level: {difficulty}
Timeframe: {time_commitment}
Total Nodes: {total_nodes}
Main Nodes: {num_main_nodes}
Checkpoints: {num_checkpoints}
Bonus Nodes: {num_bonus_nodes}

The learner expects to finish within this timeframe. Spread milestones across the FULL horizon — for goals of a year or longer, use duration_label values in months/years (phases), not a compressed "Week 1–8" sprint unless the timeframe is actually short.

Replace every [PLACEHOLDER] in the template with real, specific content for this exact goal.
Output all {total_nodes} nodes as specified above. Distribute the timeframe {time_commitment} proportionally across all nodes.
Include {num_checkpoints} checkpoint node(s) with 3-5 multiple-choice quiz questions each.
Include {num_bonus_nodes} bonus node(s) with optional advanced challenges.
Do not skip any nodes. Generate exactly {total_nodes} nodes."""


# ── Local fallback (used when LLM fails both attempts) ────────────────────────

def _build_fallback(goal: str) -> dict:
    g = goal.strip()
    return {
        "title":       f"{g} Roadmap",
        "description": "A step-by-step learning path",
        "total_xp":    900,
        "nodes": [
            {
                "id": "node_1",
                "title": f"Understand what {g} involves",
                "description": f"Research the scope of {g} and set a clear measurable goal.",
                "type": "main", "emoji": "🔍",
                "duration_label": "Week 1", "xp_reward": 100, "status": "active",
                "steps": [
                    f"Search '{g} beginner guide' and read 2-3 overviews",
                    "Write down the skills or knowledge you need to acquire",
                    "Set a measurable target (score, project, or certification)",
                    "Find a community or forum for this topic and join it",
                ],
                "resources": [
                    {"label": "freeCodeCamp", "url": "https://www.freecodecamp.org", "tip": "Free and comprehensive"},
                    {"label": "Reddit communities", "url": "https://www.reddit.com/r/learnprogramming", "tip": "Ask questions, get guidance"},
                ],
            },
            {
                "id": "node_2",
                "title": "Set up your learning environment",
                "description": "Create the accounts and install the tools you need before you start.",
                "type": "main", "emoji": "⚙️",
                "duration_label": "Week 1-2", "xp_reward": 100, "status": "locked",
                "steps": [
                    "Create any required accounts (course platforms, official sites)",
                    "Download or install recommended tools and software",
                    "Bookmark 3-5 key reference sites for quick access",
                    "Block 30 minutes daily in your calendar for practice",
                ],
                "resources": [
                    {"label": "MDN Web Docs", "url": "https://developer.mozilla.org", "tip": "Official reference"},
                    {"label": "The Odin Project", "url": "https://www.theodinproject.com", "tip": "Free structured curriculum"},
                ],
            },
            {
                "id": "node_3",
                "title": "Complete your first practice session",
                "description": "Do your first hands-on exercise to establish a baseline.",
                "type": "main", "emoji": "✏️",
                "duration_label": "Week 2-3", "xp_reward": 100, "status": "locked",
                "steps": [
                    "Pick one beginner exercise or practice test for this topic",
                    "Work through it without help first — note where you get stuck",
                    "Review your mistakes and write down areas to improve",
                    "Repeat with a new exercise the following day",
                ],
                "resources": [
                    {"label": "Kaggle Learn", "url": "https://www.kaggle.com/learn", "tip": "Hands-on micro-courses"},
                    {"label": "freeCodeCamp", "url": "https://www.freecodecamp.org/learn", "tip": "Free exercises and projects"},
                ],
            },
            {
                "id": "checkpoint_1",
                "title": f"Quiz: Understand {g} basics",
                "description": "Test your understanding of the foundation topics.",
                "type": "checkpoint", "emoji": "📝",
                "duration_label": "Week 3", "xp_reward": 50, "status": "locked",
                "quiz_questions": [
                    {"question": f"What is the first step when learning {g}?", "options": ["Research and understand scope", "Buy expensive tools", "Jump into advanced topics", "Skip to practice tests"], "correct_index": 0},
                    {"question": "Why is setting up your environment important?", "options": ["To look professional", "To have the right tools and accounts ready", "It's not really important", "Only for experts"], "correct_index": 1},
                    {"question": "What should you do after your first practice session?", "options": ["Immediately try harder problems", "Review mistakes and identify weak areas", "Give up if you struggle", "Wait a week before practicing again"], "correct_index": 1},
                ],
            },
            {
                "id": "node_4",
                "title": "Drill your weakest area",
                "description": "Identify and intensively practice your two biggest weak spots.",
                "type": "main", "emoji": "🏋️",
                "duration_label": "Week 3-4", "xp_reward": 110, "status": "locked",
                "steps": [
                    "List your 2 weakest areas based on practice session results",
                    "Find a focused resource or exercise for each weak area",
                    "Spend 20-30 min per day on these specific areas for one week",
                    "Track your improvement with a simple log or score sheet",
                ],
                "resources": [
                    {"label": "YouTube tutorials", "url": "https://www.youtube.com", "tip": "Search for targeted topic walkthroughs"},
                ],
            },
            {
                "id": "node_5",
                "title": "Take a timed mock test or project",
                "description": "Simulate the real challenge under realistic conditions.",
                "type": "main", "emoji": "🎯",
                "duration_label": "Week 4-5", "xp_reward": 120, "status": "locked",
                "steps": [
                    "Find a full practice test or project brief that matches your goal",
                    "Complete it under realistic conditions — set a timer",
                    "Score or review your output honestly against a rubric",
                    "List 3 specific improvements to make before the next attempt",
                ],
                "resources": [
                    {"label": "Kaggle Competitions", "url": "https://www.kaggle.com", "tip": "Real-world problem practice"},
                ],
            },
            {
                "id": "node_6",
                "title": "Close remaining gaps",
                "description": "Use your mock test results to fix the specific things still missing.",
                "type": "main", "emoji": "🔧",
                "duration_label": "Week 5-6", "xp_reward": 120, "status": "locked",
                "steps": [
                    "Review mock test results and rank gaps by impact",
                    "Spend one focused session on each of the top 3 gaps",
                    "Re-do the weakest section of your mock test",
                ],
                "resources": [
                    {"label": "Stack Overflow", "url": "https://stackoverflow.com", "tip": "Find answers to specific problems"},
                ],
            },
            {
                "id": "node_7",
                "title": "Final attempt and reflect",
                "description": "Do your real attempt or final project, then document what you learned.",
                "type": "main", "emoji": "🏁",
                "duration_label": "Week 7-8", "xp_reward": 150, "status": "locked",
                "steps": [
                    "Take the real exam or submit the final project",
                    "Record your score or outcome",
                    "Write down 3 things that went well and 3 that could improve",
                    "Decide on your next learning goal",
                ],
                "resources": [
                    {"label": "freeCodeCamp", "url": "https://www.freecodecamp.org", "tip": "Continue with next topic"},
                ],
            },
            {
                "id": "bonus_1",
                "title": "Go beyond — advanced challenge",
                "description": "Push past your initial goal with a harder stretch target.",
                "type": "bonus", "emoji": "⭐",
                "duration_label": "Anytime", "xp_reward": 250, "status": "locked",
                "steps": [
                    "Set a stretch goal 20% harder than your original target",
                    "Find an advanced course or mentor at this level",
                    "Document your journey and share it publicly",
                ],
                "resources": [],
            },
        ],
    }


# ── Core generation helpers ───────────────────────────────────────────────────

def _call_llm(context_text: str, goal: str, difficulty: str, time_commitment: str, total_nodes: int, num_main_nodes: int, num_checkpoints: int, num_bonus_nodes: int) -> dict:
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human",  USER_PROMPT),
    ])
    response = (prompt | llm).invoke({
        "context":         context_text,
        "goal":            goal,
        "difficulty":      difficulty,
        "time_commitment": time_commitment,
        "total_nodes":     total_nodes,
        "num_main_nodes":  num_main_nodes,
        "num_checkpoints": num_checkpoints,
        "num_bonus_nodes": num_bonus_nodes,
    })
    raw = response.content.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$',          '', raw).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise ValueError(f"Non-JSON from LLM: {raw[:300]}")


def _sanitize_urls(data: dict) -> dict:
    BAD = ["example.com", "placeholder", "N/A", "http://", "https://url", "[real-url]", "[url]"]
    FALLBACKS = [
        {"label": "freeCodeCamp",    "url": "https://www.freecodecamp.org/learn",   "tip": "Free comprehensive learning"},
        {"label": "MDN Web Docs",    "url": "https://developer.mozilla.org",         "tip": "Official web documentation"},
        {"label": "The Odin Project","url": "https://www.theodinproject.com",        "tip": "Free full-stack curriculum"},
    ]
    for node in data.get("nodes", []):
        clean = []
        for i, res in enumerate(node.get("resources", [])):
            url = res.get("url", "")
            is_bad = (
                not url
                or not url.startswith("https://")
                or any(p in url for p in BAD)
                or len(url) < 16
            )
            if is_bad:
                fb  = FALLBACKS[i % len(FALLBACKS)]
                res = {**res, "url": fb["url"], "label": res.get("label") or fb["label"], "tip": res.get("tip") or fb["tip"]}
            clean.append(res)
        node["resources"] = clean
    return data


# ── Public API ────────────────────────────────────────────────────────────────

def generate_roadmap(goal: str, difficulty: str = "beginner", time_commitment: str = "1 month") -> dict:
    context_text = "Use general knowledge."
    if retrieve_context is not None:
        try:
            docs = retrieve_context(f"{goal} {difficulty}", n_results=5)
            if docs:
                context_text = "\n\n".join(
                    f"[{d.get('source','?')}] {d.get('content', d.get('text',''))[:300]}"
                    for d in docs
                )
        except Exception as e:
            print(f"[RAG] non-fatal: {e}")

    # Calculate dynamic node counts based on timeframe
    total_nodes, num_main_nodes, num_checkpoints, num_bonus_nodes = calculate_node_count(time_commitment)
    print(f"[generate_roadmap] timeframe='{time_commitment}' → {total_nodes} nodes ({num_main_nodes} main, {num_checkpoints} checkpoints, {num_bonus_nodes} bonus)")

    data = None
    for attempt in range(2):
        try:
            data = _call_llm(context_text, goal, difficulty, time_commitment, total_nodes, num_main_nodes, num_checkpoints, num_bonus_nodes)
            nodes = data.get("nodes", [])
            
            # Validate that we have at least 3 nodes
            if len(nodes) >= 3:
                # Count node types
                main_nodes = [n for n in nodes if n.get("type") == "main"]
                checkpoints = [n for n in nodes if n.get("type") == "checkpoint"]
                bonus_nodes = [n for n in nodes if n.get("type") == "bonus"]
                
                print(f"[generate_roadmap] attempt {attempt+1}: {len(nodes)} total nodes ({len(main_nodes)} main, {len(checkpoints)} checkpoints, {len(bonus_nodes)} bonus) — OK")
                break
            else:
                print(f"[generate_roadmap] attempt {attempt+1}: only {len(nodes)} nodes (need >= 3) — retrying")
                data = None
        except Exception as e:
            print(f"[generate_roadmap] attempt {attempt+1} error: {e}")
            data = None

    if data is None:
        raise ValueError(f"Failed to generate roadmap with at least 3 nodes after 2 attempts. Goal: {goal}, Timeframe: {time_commitment}")

    if not data.get("nodes"):
        raise ValueError(f"Generated roadmap has no nodes. Goal: {goal}")

    data = _sanitize_urls(data)
    data.setdefault("total_xp", sum(n.get("xp_reward", 100) for n in data["nodes"]))
    return data


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
        res_ctx = f"\nUsing resource: {current_resource.get('label', current_resource.get('title',''))} — {current_resource.get('url','')}\n"

    goal   = roadmap_context.get("title", roadmap_context.get("goal", "the learning goal"))
    system = (
        f"You are Roadmapify's AI tutor — expert, friendly, specific.\n"
        f"Goal: {goal}\n{node_ctx}{res_ctx}\n"
        f"Give specific, actionable help. Use examples and exact steps when relevant. Keep answers concise."
    )

    messages = [("system", system)]
    for m in chat_history[-6:]:
        role = m["role"] if m["role"] in ("human", "assistant", "system") else "human"
        messages.append((role, m["content"]))
    messages.append(("human", user_message))

    try:
        response = (ChatPromptTemplate.from_messages(messages) | llm).invoke({})
        return response.content.strip()
    except Exception as e:
        print(f"[chat_with_roadmap] LLM error: {e}")
        raise


if __name__ == "__main__":
    result = generate_roadmap("prepare for IELTS and achieve a band score of 7.0", "intermediate", "2 months")
    print(json.dumps(result, indent=2))
