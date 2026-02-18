"""
FastAPI web server for Truth Timeline.

REST API endpoints for mobile/web interface.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import re
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from db import TimelineDB
from ai_suggest import suggest_definitions, analyze_question_complexity


app = FastAPI(title="Truth Timeline API")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize database
db = TimelineDB()


# Request/Response Models
class CreateNodeRequest(BaseModel):
    question: str
    user_id: str
    defining_terms: Optional[List[str]] = []
    using_terms: Optional[List[str]] = []
    parents: Optional[List[dict]] = []
    scope: Optional[str] = None


class VoteRequest(BaseModel):
    node_id: str
    user_id: str
    vote: str  # "yes", "no", or "maybe"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: str
    provider: str = "auto"  # "anthropic", "google", "openai", or "auto"


class SearchRequest(BaseModel):
    term: str
    user_id: Optional[str] = None
    scope: Optional[str] = None


class AISuggestRequest(BaseModel):
    term: str
    count: int = 3


# API Endpoints

@app.get("/")
async def root():
    """Serve the main HTML page."""
    return FileResponse("static/index.html")


@app.post("/api/nodes")
async def create_node(request: CreateNodeRequest):
    """Create a new decision node."""
    try:
        node_id = db.create_node(
            question=request.question,
            user_id=request.user_id,
            defining_terms=request.defining_terms,
            using_terms=request.using_terms,
            parents=request.parents,
            scope=request.scope
        )

        node = db.get_node(node_id)
        return {"success": True, "node": node}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/nodes/{node_id}")
async def get_node(node_id: str):
    """Get a single node by ID."""
    node = db.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    return node


SYSTEM_PROMPT = """You are a philosophical AI for Truth Timeline — an app where your statements become nodes in the user's personal truth graph.

As you respond, be clear and thoughtful. After your main response, extract 2-3 key DECLARATIVE STATEMENTS from what you said.

ALWAYS end with this exact block:
<nodes>
[
  {"text": "Short statement under 8 words", "context": "One sentence why this matters"}
]
</nodes>

Statements should be clear, testable, voteable claims. No questions. No hedging."""


def _parse_ai_content(content, user_id):
    """Parse AI response, extract nodes, create them in DB. Returns (response_text, nodes)."""
    nodes_match = re.search(r'<nodes>(.*?)</nodes>', content, re.DOTALL)
    main_response = content
    created_nodes = []

    if nodes_match:
        try:
            nodes_data = json.loads(nodes_match.group(1).strip())
            main_response = content[:nodes_match.start()].strip()

            for n in nodes_data:
                node_id = db.create_node(
                    question=n.get('text', ''),
                    user_id=user_id,
                    defining_terms=[],
                    using_terms=[],
                    scope='global'
                )
                node = db.get_node(node_id)
                if node:
                    node['context'] = n.get('context', '')
                    created_nodes.append(node)
        except Exception:
            pass

    return main_response, created_nodes


@app.get("/api/nodes/global")
async def get_global_nodes(user_id: Optional[str] = None):
    """All nodes in the system with vote counts and user's vote."""
    results = db.search_definitions(term='', scope=None, user_id=user_id)
    for r in results:
        r['vote_counts'] = db.get_vote_count(r['id'])
        if user_id:
            r['user_vote'] = db.get_vote(r['id'], user_id)
    return {"nodes": results}


@app.get("/api/providers")
async def get_providers():
    """Return which AI providers are configured (keys set)."""
    return {
        "providers": [
            {
                "id": "anthropic",
                "name": "Claude",
                "maker": "Anthropic",
                "available": bool(os.environ.get("ANTHROPIC_API_KEY")),
                "free": False
            },
            {
                "id": "google",
                "name": "Gemini",
                "maker": "Google",
                "available": bool(os.environ.get("GOOGLE_API_KEY")),
                "free": True
            },
            {
                "id": "openai",
                "name": "ChatGPT",
                "maker": "OpenAI",
                "available": bool(os.environ.get("OPENAI_API_KEY")),
                "free": False
            }
        ]
    }


def _call_anthropic(messages, user_id):
    from anthropic import Anthropic
    client   = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msgs     = [{"role": m.role, "content": m.content} for m in messages]
    response = client.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=msgs
    )
    return _parse_ai_content(response.content[0].text, user_id)


def _call_google(messages, user_id):
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
    model   = genai.GenerativeModel(model_name="gemini-1.5-flash",
                                    system_instruction=SYSTEM_PROMPT)
    history = []
    msgs    = list(messages)
    for m in msgs[:-1]:
        history.append({"role": "user" if m.role == "user" else "model",
                         "parts": [m.content]})
    chat   = model.start_chat(history=history)
    result = chat.send_message(msgs[-1].content if msgs else "")
    return _parse_ai_content(result.text, user_id)


def _call_openai(messages, user_id):
    from openai import OpenAI
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    msgs   = [{"role": "system", "content": SYSTEM_PROMPT}]
    msgs  += [{"role": m.role, "content": m.content} for m in messages]
    resp   = client.chat.completions.create(model="gpt-4o-mini", messages=msgs, max_tokens=1024)
    return _parse_ai_content(resp.choices[0].message.content, user_id)


_CALLERS = {
    "anthropic": (_call_anthropic, "ANTHROPIC_API_KEY"),
    "google":    (_call_google,    "GOOGLE_API_KEY"),
    "openai":    (_call_openai,    "OPENAI_API_KEY"),
}


@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest):
    """Send message to chosen AI provider, return response + extracted nodes."""
    provider = request.provider

    # Build ordered list: chosen provider first, then others as fallback
    order = [provider] if provider != "auto" else ["anthropic", "google", "openai"]
    if provider not in ("auto", "anthropic"):
        order += [p for p in ["anthropic", "google", "openai"] if p != provider]

    for p in order:
        fn, env_key = _CALLERS[p]
        if not os.environ.get(env_key):
            continue
        try:
            main_response, nodes = fn(request.messages, request.user_id)
            return {"response": main_response, "nodes": nodes, "provider": p}
        except Exception as e:
            err = str(e)
            # Only fall through on credit/billing errors; hard-fail on others
            if not any(w in err.lower() for w in ("credit", "billing", "balance", "quota")):
                return {"response": f"AI error: {err}", "nodes": [], "provider": p}

    return {
        "response": "No AI key configured. Ask the app owner to add GOOGLE_API_KEY (free), ANTHROPIC_API_KEY, or OPENAI_API_KEY in Replit Secrets.",
        "nodes": [],
        "provider": None
    }


@app.post("/api/votes")
async def vote(request: VoteRequest):
    """Vote on a node."""
    try:
        if request.vote not in ["yes", "no", "maybe"]:
            raise HTTPException(status_code=400, detail="Vote must be 'yes', 'no', or 'maybe'")

        db.vote(request.node_id, request.user_id, request.vote)

        # Get updated node with vote counts
        node = db.get_node(request.node_id)
        vote_counts = db.get_vote_count(request.node_id)
        user_vote = db.get_vote(request.node_id, request.user_id)

        return {
            "success": True,
            "node": node,
            "vote_counts": vote_counts,
            "user_vote": user_vote
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/votes/{node_id}/{user_id}")
async def get_vote(node_id: str, user_id: str):
    """Get user's vote on a node."""
    vote = db.get_vote(node_id, user_id)
    return {"vote": vote}


@app.post("/api/search")
async def search_definitions(request: SearchRequest):
    """Search for definitions of a term."""
    results = db.search_definitions(
        term=request.term,
        scope=request.scope,
        user_id=request.user_id
    )

    # Add vote counts to each result
    for result in results:
        result['vote_counts'] = db.get_vote_count(result['id'])
        if request.user_id:
            result['user_vote'] = db.get_vote(result['id'], request.user_id)

    return {"results": results}


@app.get("/api/timeline/{user_id}")
async def get_timeline(user_id: str, vote_filter: str = "yes"):
    """Get user's timeline."""
    timeline = db.get_user_timeline(user_id, vote_filter)

    # Parse JSON fields for easier frontend consumption
    for node in timeline:
        node['defining_terms_list'] = json.loads(node.get('defining_terms', '[]'))
        node['using_terms_list'] = json.loads(node.get('using_terms', '[]'))
        node['parents_list'] = json.loads(node.get('parents', '[]'))

    return {"timeline": timeline}


@app.get("/api/orphaned/{user_id}")
async def get_orphaned(user_id: str):
    """Get orphaned nodes for user."""
    orphaned = db.get_orphaned_nodes(user_id)
    return {"orphaned": orphaned}


@app.post("/api/ai/suggest")
async def ai_suggest(request: AISuggestRequest):
    """Get AI suggestions for defining a term."""
    suggestions = suggest_definitions(request.term, request.count)
    return {"suggestions": suggestions}


@app.get("/api/ai/analyze")
async def ai_analyze(question: str):
    """Analyze question complexity."""
    analysis = analyze_question_complexity(question)
    return analysis


@app.get("/api/stats")
async def get_stats():
    """Get database statistics."""
    return db.get_stats()


@app.get("/api/words/classify/{word}")
async def classify_word(word: str):
    """Classify a word into its tier."""
    classification = db.classify_word(word)
    return classification


@app.get("/api/words/tier/{word}")
async def get_word_tier(word: str):
    """Get the tier of a word."""
    tier = db.get_word_tier(word)
    return {"word": word, "tier": tier}


@app.post("/api/words/check-undefined")
async def check_undefined(request: dict):
    """Check which terms in a list are undefined for a user."""
    terms = request.get('terms', [])
    user_id = request.get('user_id')

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    undefined = db.get_undefined_terms(terms, user_id)
    return {"undefined": undefined}


@app.post("/api/words/check-circular")
async def check_circular(request: dict):
    """Check if a definition would be circular."""
    term = request.get('term')
    question = request.get('question')

    if not term or not question:
        raise HTTPException(status_code=400, detail="term and question are required")

    result = db.detect_circular_definition(term, question)
    return result


@app.get("/api/words/depth/{term}/{user_id}")
async def get_definition_depth(term: str, user_id: str):
    """Get the definition depth for a term."""
    depth_info = db.calculate_definition_depth(term, user_id)
    return depth_info


@app.get("/api/words/primitives")
async def get_primitives():
    """Get all semantic primitives."""
    cursor = db.conn.cursor()
    primitives = cursor.execute(
        "SELECT * FROM word_classes WHERE tier = 'primitive' ORDER BY word"
    ).fetchall()

    return {"primitives": [dict(p) for p in primitives]}


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
