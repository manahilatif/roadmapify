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
    model="llama-3.3-70b-versatile",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.7,
    max_tokens=4096,
)

# ── Prompts ───────────────────────────────────────────────────────────────────
#
# KEY DESIGN DECISIONS:
#   1. Every placeholder uses [BRACKET] syntax — the model fills these in.
#   2. All 8 nodes are shown explicitly in the template — no "..." anywhere.
#   3. JSON braces are escaped as {{ / }} for LangChain's template engine.
#
SYSTEM_PROMPT = """You are Roadmapify. Return a complete learning roadmap as a JSON object.

Context: {context}

RULES:
1. Output EXACTLY 9 nodes: node_1, node_2, node_3, checkpoint_1, node_4, node_5, node_6, node_7, bonus_1
2. node_1 status "active"; all others status "locked"
3. node_1 through node_7 type "main"; checkpoint_1 type "checkpoint"; bonus_1 type "bonus"
4. **IMPORTANT**: After every 3-4 learning nodes, insert a checkpoint node to reinforce learning.
5. Checkpoint nodes must include a "quiz_questions" array with 3-5 multiple-choice questions relevant to the preceding nodes.
   Each question: {{"question": "...", "options": ["A", "B", "C", "D"], "correct_index": 0}}
6. Each title must be 3-7 words, SPECIFIC to the learner's goal.
   FORBIDDEN titles: "Getting Started", "Foundation", "Learn basics", "Core Skills", "Introduction", "Overview"
7. Each main node: steps (3-5 concrete how-to instructions) and resources (2 real https:// URLs)
8. Checkpoint nodes: only need title, description, and quiz_questions. No steps or resources required.
9. Do NOT use "..." anywhere. Write all 9 nodes in full.

Real resource URLs:
https://www.ielts.org | https://ieltsliz.com | https://www.ielts-simon.com
https://www.britishcouncil.org/exam/ielts/ielts-practice-tests
https://www.freecodecamp.org/learn | https://javascript.info
https://developer.mozilla.org | https://docs.python.org/3/tutorial
https://www.kaggle.com/learn | https://git-scm.com/book/en/v2
https://tailwindcss.com/docs | https://docs.docker.com/get-started

Return ONLY valid JSON. Start with {{ and end with }}. No markdown. No text outside the JSON.

Template — replace every [PLACEHOLDER] with real goal-specific content:
{{
  "title": "[Goal name] Roadmap",
  "description": "[One sentence about this learning path]",
  "total_xp": 850,
  "nodes": [
    {{
      "id": "node_1",
      "title": "[Specific first task for this goal]",
      "description": "[One sentence explaining what the learner does]",
      "type": "main",
      "emoji": "[single emoji]",
      "duration_label": "Week 1",
      "xp_reward": 100,
      "status": "active",
      "steps": ["[Exact action 1]", "[Exact action 2]", "[Exact action 3]", "[Exact action 4]"],
      "resources": [
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}},
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}}
      ]
    }},
    {{
      "id": "node_2",
      "title": "[Specific second task for this goal]",
      "description": "[One sentence]",
      "type": "main",
      "emoji": "[single emoji]",
      "duration_label": "Week 2",
      "xp_reward": 100,
      "status": "locked",
      "steps": ["[Exact action 1]", "[Exact action 2]", "[Exact action 3]"],
      "resources": [
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}},
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}}
      ]
    }},
    {{
      "id": "node_3",
      "title": "[Specific third task for this goal]",
      "description": "[One sentence]",
      "type": "main",
      "emoji": "[single emoji]",
      "duration_label": "Week 3",
      "xp_reward": 100,
      "status": "locked",
      "steps": ["[Exact action 1]", "[Exact action 2]", "[Exact action 3]"],
      "resources": [
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}},
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}}
      ]
    }},
    {{
      "id": "checkpoint_1",
      "title": "Quiz: Review nodes 1-3",
      "description": "Test your understanding of the first three topics.",
      "type": "checkpoint",
      "emoji": "📝",
      "duration_label": "Week 3-4",
      "xp_reward": 50,
      "status": "locked",
      "quiz_questions": [
        {{"question": "[Question about node 1, 2, or 3 content]", "options": ["[Option A]", "[Option B]", "[Option C]", "[Option D]"], "correct_index": 0}},
        {{"question": "[Another question]", "options": ["[Option A]", "[Option B]", "[Option C]", "[Option D]"], "correct_index": 1}},
        {{"question": "[Another question]", "options": ["[Option A]", "[Option B]", "[Option C]", "[Option D]"], "correct_index": 2}}
      ]
    }},
    {{
      "id": "node_4",
      "title": "[Specific fourth task for this goal]",
      "description": "[One sentence]",
      "type": "main",
      "emoji": "[single emoji]",
      "duration_label": "Week 4",
      "xp_reward": 110,
      "status": "locked",
      "steps": ["[Exact action 1]", "[Exact action 2]", "[Exact action 3]"],
      "resources": [
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}},
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}}
      ]
    }},
    {{
      "id": "node_5",
      "title": "[Specific fifth task for this goal]",
      "description": "[One sentence]",
      "type": "main",
      "emoji": "[single emoji]",
      "duration_label": "Week 5",
      "xp_reward": 120,
      "status": "locked",
      "steps": ["[Exact action 1]", "[Exact action 2]", "[Exact action 3]"],
      "resources": [
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}}
      ]
    }},
    {{
      "id": "node_6",
      "title": "[Specific sixth task for this goal]",
      "description": "[One sentence]",
      "type": "main",
      "emoji": "[single emoji]",
      "duration_label": "Week 6",
      "xp_reward": 120,
      "status": "locked",
      "steps": ["[Exact action 1]", "[Exact action 2]", "[Exact action 3]"],
      "resources": [
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}}
      ]
    }},
    {{
      "id": "node_7",
      "title": "[Specific seventh task for this goal]",
      "description": "[One sentence]",
      "type": "main",
      "emoji": "[single emoji]",
      "duration_label": "Week 7-8",
      "xp_reward": 150,
      "status": "locked",
      "steps": ["[Exact action 1]", "[Exact action 2]", "[Exact action 3]"],
      "resources": [
        {{"label": "[Resource name]", "url": "https://[real-url]", "tip": "[Why useful]"}}
      ]
    }},
    {{
      "id": "bonus_1",
      "title": "[Advanced challenge title]",
      "description": "[One sentence]",
      "type": "bonus",
      "emoji": "⭐",
      "duration_label": "Anytime",
      "xp_reward": 250,
      "status": "locked",
      "steps": ["[Advanced step 1]", "[Advanced step 2]"],
      "resources": []
    }}
  ]
}}"""

USER_PROMPT = """Generate the roadmap for:

Goal: {goal}
Level: {difficulty}
Timeframe: {time_commitment}

Replace every [PLACEHOLDER] in the template with real, specific content for this exact goal.
Output all 9 nodes (node_1 through node_7, plus checkpoint_1 after node_3, and bonus_1). 
Include 3-5 multiple-choice quiz questions in checkpoint_1 that test understanding of the first 3 nodes.
Do not skip any node."""


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

def _call_llm(context_text: str, goal: str, difficulty: str, time_commitment: str) -> dict:
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human",  USER_PROMPT),
    ])
    response = (prompt | llm).invoke({
        "context":         context_text,
        "goal":            goal,
        "difficulty":      difficulty,
        "time_commitment": time_commitment,
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

    data = None
    for attempt in range(2):
        try:
            data = _call_llm(context_text, goal, difficulty, time_commitment)
            main_nodes = [n for n in data.get("nodes", []) if n.get("type") != "bonus"]
            if len(main_nodes) >= 4:
                print(f"[generate_roadmap] attempt {attempt+1}: {len(main_nodes)} main nodes — OK")
                break
            print(f"[generate_roadmap] attempt {attempt+1}: only {len(main_nodes)} main nodes — retrying")
            data = None
        except Exception as e:
            print(f"[generate_roadmap] attempt {attempt+1} error: {e}")
            data = None

    if data is None:
        print("[generate_roadmap] both attempts failed — using built-in fallback")
        return _build_fallback(goal)

    if not data.get("nodes"):
        return _build_fallback(goal)

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
