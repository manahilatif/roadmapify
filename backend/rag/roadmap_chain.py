"""
roadmap_chain.py
----------------
LangChain + Gemini orchestration for Roadmapify.

Key upgrade: classifies goal type first (one_time | skill | project | habit),
then generates a FULLY goal-specific roadmap with micro-task nodes,
dynamic timeframe options, and gamification metadata.
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
import os, json, re

try:
    from backend.rag.rag_pipeline import retrieve_context
except ImportError:
    def retrieve_context(query: str) -> str:
        return ""

# ── LLM ───────────────────────────────────────────────────────────────────────

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7,
)

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Roadmapify — an expert learning coach that turns any goal into a gamified, step-by-step roadmap.

Retrieved Knowledge (use this to inform specific steps, tools, and resources):
{context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Classify the goal type:
  - "one_time"  → a single task/event (cook a dish, fix something, write one thing)
  - "skill"     → learning a skill over time (learn Figma, get into ML, speak Spanish)
  - "project"   → building/creating something with deliverables (build a portfolio, launch an app)
  - "habit"     → a recurring behaviour to build (run every day, meditate, read 30 min/day)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Generate the roadmap JSON.

RULES:
1. Nodes must be MICRO-TASKS specific to the actual goal — never generic like "Foundation" or "Core Skills" or "Advanced Topics".
   BAD example for "bake sourdough bread": Foundation → Core Skills → Projects → Ship It
   GOOD example: Mix flour + water → Autolyse 30 min → Add starter + salt → Stretch & fold (4x) → Bulk ferment 4-8h → Shape loaf → Cold proof overnight → Score & bake 50 min
   
2. Node titles should be SHORT, ACTION-ORIENTED verbs (mix, build, practice, deploy, write, test).

3. The "duration_label" for one_time goals = time estimate (e.g. "30 min", "overnight", "2 hrs").
   For skill/project/habit goals = week label (e.g. "Week 1-2", "Day 3-5").

4. EXACTLY ONE bonus node — make it genuinely fun, creative, or surprising for that specific goal.
   BAD bonus: "Advanced Topics"
   GOOD bonus for sourdough: "Add rosemary & sea salt topping 🌿"
   GOOD bonus for learning Figma: "Recreate the Spotify UI from memory"
   GOOD bonus for running habit: "Sign up for a 5K race"

5. timeframe_options must match the goal type:
   - one_time → ["30 min", "1–2 hours", "half a day", "full day"]
   - skill     → ["2 weeks", "1 month", "3 months", "6 months"]
   - project   → ["1 week", "2 weeks", "1 month", "3 months"]
   - habit     → ["1 week", "2 weeks", "1 month", "3 months"]

6. Each node must have 1–3 resources (tool name OR url OR both). For one_time goals, resources can be tips instead.

7. xp_reward scales with node difficulty: easy=50, medium=100, hard=150, boss=200.

8. "emoji" field: pick a relevant emoji for each node (used as the node icon when unlocked).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — respond ONLY with valid JSON, no markdown fences, no explanation:

{
  "title": "string — specific roadmap title",
  "goal_type": "one_time | skill | project | habit",
  "total_xp": number,
  "timeframe_options": [
    { "label": "string", "sublabel": "string", "value": "string" }
  ],
  "nodes": [
    {
      "id": "node_1",
      "title": "string — short action verb phrase",
      "description": "string — 1–2 sentences of what to actually do",
      "duration_label": "string",
      "status": "active",
      "type": "main",
      "xp_reward": number,
      "emoji": "string",
      "resources": [
        { "label": "string", "url": "string or empty", "tip": "string or empty" }
      ]
    },
    ...more main nodes (4–7 total for one_time, 5–8 for skill/project/habit)...
    {
      "id": "bonus_1",
      "title": "string — fun/creative bonus task",
      "description": "string",
      "duration_label": "string",
      "status": "locked",
      "type": "bonus",
      "xp_reward": 250,
      "emoji": "⭐",
      "resources": [...]
    }
  ]
}
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "User goal: {user_input}\nSelected timeframe: {timeframe}\nExperience level: {experience}"),
])

chain = prompt | llm


# ── Public API ─────────────────────────────────────────────────────────────────

def generate_roadmap(
    goal: str,
    timeframe: str = "not selected yet",
    experience: str = "beginner",
) -> dict:
    """
    Returns a fully parsed roadmap dict.
    Falls back to a safe error structure if anything fails.
    """
    context = retrieve_context(goal)

    try:
        response = chain.invoke({
            "context": context,
            "user_input": goal,
            "timeframe": timeframe,
            "experience": experience,
        })
        raw = response.content.strip()

        # Strip markdown fences if model wraps in ```json
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

        roadmap = json.loads(raw)

        # Ensure node statuses are correct: first = active, rest = locked
        for i, node in enumerate(roadmap.get("nodes", [])):
            if i == 0 and node.get("type") == "main":
                node["status"] = "active"
            elif node.get("status") == "active" and i > 0:
                node["status"] = "locked"

        # Calculate total XP
        roadmap["total_xp"] = sum(
            n.get("xp_reward", 100) for n in roadmap.get("nodes", [])
        )

        return roadmap

    except Exception as e:
        print(f"[roadmap_chain] Error: {e}")
        return _fallback_roadmap(goal)


def _fallback_roadmap(goal: str) -> dict:
    return {
        "title": f"Your {goal} Roadmap",
        "goal_type": "skill",
        "total_xp": 500,
        "timeframe_options": [
            {"label": "2 weeks", "sublabel": "Sprint", "value": "2_weeks"},
            {"label": "1 month", "sublabel": "Steady", "value": "1_month"},
            {"label": "3 months", "sublabel": "Deep dive", "value": "3_months"},
        ],
        "nodes": [
            {
                "id": "node_1", "title": "Get started", "description": "Begin your journey.",
                "duration_label": "Day 1", "status": "active", "type": "main",
                "xp_reward": 100, "emoji": "🚀",
                "resources": [{"label": "Google it", "url": "", "tip": "Search for beginner guides"}],
            },
        ],
    }