"""
roadmap_chain.py
----------------
LangChain + Groq. Outputs nodes[] schema that the RoadmapPage expects.
Forces 5-7 main nodes with step-by-step instructions and real resource URLs.
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
    model="llama3-70b-8192",
    groq_api_key=os.getenv("GROQ_API_KEY"),
    temperature=0.4,
)

SYSTEM_PROMPT = """You are Roadmapify, an expert learning curriculum designer.

Retrieved Knowledge:
{context}

Generate a learning roadmap as a JSON object.

STRICT RULES — violating any rule makes the output useless:
1. You MUST generate exactly 5 to 7 nodes with type "main", plus exactly 1 node with type "bonus". Total = 6 to 8 nodes.
2. Each main node = one focused learning stage (e.g. "Set up your environment", "Master reading skills", "Practice writing essays").
3. The first node always has status "active". ALL other nodes have status "locked".
4. Each node MUST have a "steps" array with 3 to 5 specific, numbered instructions telling the user exactly what to do.
5. Each node MUST have a "resources" array with 2 to 3 real items. URLs must start with https:// and be from real sites.

REAL URL EXAMPLES you may use:
- https://www.freecodecamp.org/learn
- https://developer.mozilla.org/en-US/docs/Web/JavaScript
- https://javascript.info
- https://reactjs.org/docs/getting-started.html
- https://nodejs.org/en/docs/guides/getting-started-guide
- https://www.postgresql.org/docs/current/tutorial.html
- https://git-scm.com/book/en/v2
- https://docs.python.org/3/tutorial
- https://www.youtube.com/watch?v=PkZNo7MFNFg
- https://www.youtube.com/watch?v=rfscVS0vtbw
- https://www.youtube.com/watch?v=UB1O30fR-EE
- https://www.youtube.com/watch?v=Ke90Tje7VS0
- https://css-tricks.com/snippets/css/a-guide-to-flexbox
- https://www.ielts.org/about-ielts/what-is-ielts
- https://www.britishcouncil.org/exam/ielts/ielts-practice-tests
- https://ieltsliz.com
- https://www.ielts-simon.com
- https://www.kaggle.com/learn
- https://www.w3schools.com
- https://tailwindcss.com/docs
- https://docs.docker.com/get-started
- https://www.figma.com/resources/learn-design

OUTPUT FORMAT — return ONLY this JSON, no markdown, no explanation:
{{
  "title": "string — descriptive roadmap title",
  "description": "string",
  "total_xp": number,
  "nodes": [
    {{
      "id": "node_1",
      "title": "string — specific stage name",
      "description": "string — 1-2 sentences what this stage covers",
      "type": "main",
      "emoji": "single emoji",
      "duration_label": "e.g. Week 1-2",
      "xp_reward": number,
      "status": "active",
      "steps": [
        "Step 1: [exact specific action the user should take]",
        "Step 2: [next action]",
        "Step 3: [next action]"
      ],
      "resources": [
        {{
          "label": "Resource name",
          "url": "https://real-url.com/path",
          "tip": "Why this resource is useful"
        }}
      ]
    }},
    ... 4 to 6 more main nodes with status "locked" ...
    {{
      "id": "bonus_1",
      "title": "string — advanced challenge title",
      "description": "string",
      "type": "bonus",
      "emoji": "⭐",
      "duration_label": "Anytime",
      "xp_reward": 250,
      "status": "locked",
      "steps": ["Step 1: [advanced action]", "Step 2: [advanced action]"],
      "resources": []
    }}
  ]
}}"""

USER_PROMPT = """Create a complete learning roadmap for:

Goal: {goal}
Difficulty: {difficulty}
Time available: {time_commitment}

Remember: generate 5-7 main nodes + 1 bonus node. Each node needs steps[] and resources[] with real URLs."""


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

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", USER_PROMPT),
    ])

    response = (prompt | llm).invoke({
        "context":         context_text,
        "goal":            goal,
        "difficulty":      difficulty,
        "time_commitment": time_commitment,
    })

    raw = response.content.strip()
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            data = json.loads(m.group())
        else:
            raise ValueError(f"Non-JSON from LLM: {raw[:300]}")

    if not data.get("nodes"):
        raise ValueError("No nodes returned by LLM")

    # Sanitize: fix placeholder/empty URLs
    BAD = ["example.com", "placeholder", "N/A", "http://", "https://url"]
    FALLBACKS = [
        {"label": "freeCodeCamp", "url": "https://www.freecodecamp.org/learn", "tip": "Free comprehensive learning platform"},
        {"label": "MDN Web Docs", "url": "https://developer.mozilla.org", "tip": "Official web documentation"},
        {"label": "The Odin Project", "url": "https://www.theodinproject.com", "tip": "Free full-stack curriculum"},
    ]
    for node in data["nodes"]:
        clean = []
        for i, res in enumerate(node.get("resources", [])):
            url = res.get("url", "")
            is_bad = not url or not url.startswith("https://") or any(p in url for p in BAD) or len(url) < 16
            if is_bad:
                fb = FALLBACKS[i % len(FALLBACKS)]
                res = {**res, "url": fb["url"], "label": res.get("label") or fb["label"], "tip": res.get("tip") or fb["tip"]}
            clean.append(res)
        node["resources"] = clean

    data.setdefault("total_xp", sum(n.get("xp_reward", 100) for n in data["nodes"]))
    return data


def chat_with_roadmap(user_message, roadmap_context, current_module, current_resource, chat_history):
    node_ctx = ""
    if current_module:
        steps = current_module.get("steps", [])
        node_ctx = f"\nCurrently on: {current_module.get('title','')}\nDescription: {current_module.get('description','')}\nSteps: {json.dumps(steps)}\n"
    res_ctx = ""
    if current_resource:
        res_ctx = f"\nUsing resource: {current_resource.get('label', current_resource.get('title',''))} — {current_resource.get('url','')}\n"

    system = f"""You are Roadmapify's AI tutor — expert, friendly, specific.
Goal: {roadmap_context.get('title', roadmap_context.get('goal', ''))}
{node_ctx}{res_ctx}
Give specific, actionable help. Use code examples and exact commands when relevant."""

    messages = [("system", system)]
    for m in chat_history[-10:]:
        messages.append((m["role"], m["content"]))
    messages.append(("human", user_message))

    return (ChatPromptTemplate.from_messages(messages) | llm).invoke({}).content.strip()


if __name__ == "__main__":
    result = generate_roadmap("prepare for IELTS and achieve a band score of 7.0", "intermediate", "2 months")
    print(json.dumps(result, indent=2))