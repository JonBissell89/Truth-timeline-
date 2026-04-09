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
    api_key: str                        # user's own Anthropic key — never stored server-side
    nodes: Optional[List[dict]] = []    # user's current decision graph for context


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


@app.get("/api/nodes/global")
async def get_global_nodes(user_id: Optional[str] = None):
    """All nodes with community vote counts and the requesting user's vote."""
    cur = db._cursor()
    cur.execute("SELECT * FROM nodes ORDER BY created_at DESC")
    nodes = db._fetchall(cur)

    # Bulk vote counts — 1 query instead of N
    cur.execute("SELECT node_id, vote, COUNT(*) AS c FROM votes GROUP BY node_id, vote")
    counts_map = {}
    for row in db._fetchall(cur):
        counts_map.setdefault(row['node_id'], {"yes": 0, "no": 0, "maybe": 0})
        counts_map[row['node_id']][row['vote']] = row['c']

    user_votes = db.get_user_votes_bulk(user_id) if user_id else {}

    for n in nodes:
        n['vote_counts'] = counts_map.get(n['id'], {"yes": 0, "no": 0, "maybe": 0})
        n['user_vote']   = user_votes.get(n['id']) if user_id else None

    return {"nodes": nodes}


@app.get("/api/nodes/compare")
async def compare_nodes(user_a: str, user_b: str):
    """Return all nodes with both users' votes for side-by-side comparison."""
    nodes = db.get_compare_nodes(user_a, user_b)
    has_b = any(n.get('vote_b') for n in nodes)
    if not has_b:
        return {"nodes": nodes, "user_a": user_a, "user_b": user_b, "warning": f"No votes found for '{user_b}'"}
    return {"nodes": nodes, "user_a": user_a, "user_b": user_b}


@app.get("/api/nodes/{node_id}")
async def get_node(node_id: str):
    """Get a single node by ID."""
    node = db.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


BASE_PROMPT = """You are Claude, the AI inside Truth Timeline — an app that maps a person's reasoning across all their conversations as a visual decision graph.

Every statement you make can become a node the user votes TRUE, FALSE, or PERHAPS. Over time, this graph becomes their reasoning lineage — a structured record of everything they've concluded, rejected, or are still working through.

Your role:
- Be aware of the user's existing decisions (provided below). Don't re-derive what they've already settled.
- Focus depth on their PERHAPS nodes — those are live, unresolved questions.
- If something you say conflicts with a node they voted TRUE or FALSE, surface that tension explicitly.
- Build on their reasoning history rather than starting from zero each time.

After every response, extract 2-3 key DECLARATIVE STATEMENTS from what you said.
ALWAYS end with this exact block:
<nodes>
[
  {"text": "Claim under 8 words", "context": "One sentence why this matters"}
]
</nodes>

Statements must be clear, voteable claims — no questions, no hedging."""


def build_system_prompt(nodes: list) -> str:
    if not nodes:
        return BASE_PROMPT + "\n\nThis is the user's first conversation — no decision history yet."

    true_nodes    = [n for n in nodes if n.get('vote') == 'yes']
    false_nodes   = [n for n in nodes if n.get('vote') == 'no']
    perhaps_nodes = [n for n in nodes if n.get('vote') == 'maybe']
    unvoted       = [n for n in nodes if not n.get('vote')]

    sections = []
    if true_nodes:
        lines = '\n'.join(f"  - {n['text']}" for n in true_nodes)
        sections.append(f"SETTLED TRUE (user has committed to these):\n{lines}")
    if false_nodes:
        lines = '\n'.join(f"  - {n['text']}" for n in false_nodes)
        sections.append(f"SETTLED FALSE (user has rejected these):\n{lines}")
    if perhaps_nodes:
        lines = '\n'.join(f"  - {n['text']}" for n in perhaps_nodes)
        sections.append(f"UNCERTAIN / PERHAPS (open questions — prioritize these):\n{lines}")
    if unvoted:
        lines = '\n'.join(f"  - {n['text']}" for n in unvoted[:10])  # cap at 10
        sections.append(f"UNVOTED (raised but no stance yet):\n{lines}")

    graph_context = "\n\n".join(sections)
    return f"{BASE_PROMPT}\n\n--- USER'S DECISION GRAPH ---\n{graph_context}\n--- END GRAPH ---"


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





def _call_claude(messages, user_id, system_prompt, api_key: str):
    from anthropic import Anthropic
    client   = Anthropic(api_key=api_key)
    msgs     = [{"role": m.role, "content": m.content} for m in messages]
    response = client.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=1024,
        system=system_prompt,
        messages=msgs
    )
    return _parse_ai_content(response.content[0].text, user_id)


@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest):
    """Send message to Claude with the user's decision graph as context."""
    if not request.api_key:
        return {"response": "No API key provided. Add your Anthropic key on the login screen.", "nodes": []}

    system_prompt = build_system_prompt(request.nodes or [])

    try:
        main_response, nodes = _call_claude(request.messages, request.user_id, system_prompt, request.api_key)
        return {"response": main_response, "nodes": nodes}
    except Exception as e:
        return {"response": f"Claude error: {str(e)}", "nodes": []}


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
