"""
Database layer for Truth Timeline.

Supports both SQLite (local dev) and PostgreSQL (production).
Auto-detects from DATABASE_URL environment variable.
"""

import json
import uuid
import os
from typing import List, Dict, Optional, Set
from datetime import datetime


def _get_database_url():
    return os.environ.get("DATABASE_URL", "sqlite:///data/timeline.db")


def _is_postgres(url: str) -> bool:
    return url.startswith("postgresql://") or url.startswith("postgres://")


class TimelineDB:
    """
    Database for Truth Timeline.
    Auto-selects SQLite or PostgreSQL based on DATABASE_URL env var.
    """

    def __init__(self):
        self.database_url = _get_database_url()
        self.pg = _is_postgres(self.database_url)
        self.conn = self._connect()
        self._create_schema()

    def _connect(self):
        if self.pg:
            import psycopg2
            import psycopg2.extras
            conn = psycopg2.connect(self.database_url)
            conn.autocommit = False
            return conn
        else:
            import sqlite3
            # Strip sqlite:/// prefix
            db_path = self.database_url.replace("sqlite:///", "")
            db_dir = os.path.dirname(db_path)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir)
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            return conn

    def _cursor(self):
        """Return a cursor, auto-reconnecting if needed (PostgreSQL)."""
        if self.pg:
            import psycopg2
            import psycopg2.extras
            try:
                if self.conn.closed:
                    self.conn = self._connect()
                cur = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            except Exception:
                self.conn = self._connect()
                cur = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            return cur
        else:
            return self.conn.cursor()

    def _commit(self):
        if not self.pg or not self.conn.autocommit:
            self.conn.commit()

    def _ph(self) -> str:
        """Return the placeholder character for this database."""
        return "%s" if self.pg else "?"

    def _fetchone(self, cursor) -> Optional[Dict]:
        row = cursor.fetchone()
        if row is None:
            return None
        return dict(row)

    def _fetchall(self, cursor) -> List[Dict]:
        return [dict(row) for row in cursor.fetchall()]

    def _create_schema(self):
        """Create tables and indexes if they don't exist."""
        cur = self._cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                question TEXT NOT NULL,
                defining_terms TEXT,
                using_terms TEXT,
                parents TEXT,
                scope TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at BIGINT NOT NULL
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                node_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                vote TEXT NOT NULL,
                voted_at BIGINT NOT NULL,
                PRIMARY KEY (node_id, user_id)
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS word_classes (
                word TEXT PRIMARY KEY,
                tier TEXT NOT NULL,
                definition_type TEXT,
                image_url TEXT,
                primitive_decomposition TEXT,
                notes TEXT
            )
        """)

        # Indexes (IF NOT EXISTS supported in both)
        for idx_sql in [
            "CREATE INDEX IF NOT EXISTS idx_nodes_scope ON nodes(scope)",
            "CREATE INDEX IF NOT EXISTS idx_nodes_defining ON nodes(defining_terms)",
            "CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_votes_node ON votes(node_id)",
            "CREATE INDEX IF NOT EXISTS idx_word_tier ON word_classes(tier)",
        ]:
            cur.execute(idx_sql)

        self._commit()
        self._load_primitives()

    def _load_primitives(self):
        """Load semantic primitives from JSON file if not already loaded."""
        ph = self._ph()
        cur = self._cursor()

        cur.execute("SELECT COUNT(*) AS c FROM word_classes WHERE tier = 'primitive'")
        if self._fetchone(cur)['c'] > 0:
            return

        primitives_path = os.path.join(os.path.dirname(__file__), 'semantic_primitives.json')
        if not os.path.exists(primitives_path):
            return

        with open(primitives_path, 'r') as f:
            data = json.load(f)

        if self.pg:
            upsert_full = f"""
                INSERT INTO word_classes (word, tier, definition_type, notes)
                VALUES ({ph}, {ph}, {ph}, {ph})
                ON CONFLICT (word) DO NOTHING
            """
            upsert_short = f"""
                INSERT INTO word_classes (word, tier, definition_type)
                VALUES ({ph}, {ph}, {ph})
                ON CONFLICT (word) DO NOTHING
            """
        else:
            upsert_full = "INSERT OR IGNORE INTO word_classes (word, tier, definition_type, notes) VALUES (?, ?, ?, ?)"
            upsert_short = "INSERT OR IGNORE INTO word_classes (word, tier, definition_type) VALUES (?, ?, ?)"

        for word, info in data.get('primitives', {}).items():
            cur.execute(upsert_full, (word.lower(), info['tier'], info['type'], info.get('notes', '')))

        for word, info in data.get('functional', {}).items():
            cur.execute(upsert_short, (word.lower(), info['tier'], info['type']))

        self._commit()

    # ─── Word Classification ───────────────────────────────────────────────────

    def classify_word(self, word: str) -> Dict:
        ph = self._ph()
        cur = self._cursor()
        cur.execute(f"SELECT * FROM word_classes WHERE word = {ph}", (word.lower(),))
        row = self._fetchone(cur)

        if row:
            return {
                'word': word.lower(),
                'tier': row['tier'],
                'type': row['definition_type'],
                'needs_definition': row['tier'] not in ['primitive', 'functional']
            }

        primitives_path = os.path.join(os.path.dirname(__file__), 'semantic_primitives.json')
        if os.path.exists(primitives_path):
            with open(primitives_path, 'r') as f:
                data = json.load(f)
            if word.lower() in data.get('subjective_markers', []):
                return {'word': word.lower(), 'tier': 'subjective', 'type': 'personal', 'needs_definition': True}

        return {'word': word.lower(), 'tier': 'derived', 'type': 'unknown', 'needs_definition': True}

    def get_word_tier(self, word: str) -> str:
        return self.classify_word(word)['tier']

    def get_undefined_terms(self, terms: List[str], user_id: str) -> List[Dict]:
        undefined = []
        for term in terms:
            c = self.classify_word(term)
            if c['tier'] in ['functional', 'primitive']:
                continue
            personal = self.search_definitions(term, user_id=user_id)
            if not personal:
                community = self.search_definitions(term, scope="community:%")
                undefined.append({
                    'term': term,
                    'classification': c,
                    'community_definitions': len(community),
                    'suggested_action': 'define' if not community else 'vote_or_define'
                })
        return undefined

    def detect_circular_definition(self, term: str, question: str, max_depth: int = 10) -> Dict:
        if term.lower() in question.lower().split():
            return {
                'is_circular': True,
                'reason': f'"{term}" appears in its own definition',
                'path': [term, term]
            }
        return {'is_circular': False, 'reason': None, 'path': []}

    def calculate_definition_depth(self, term: str, user_id: str, max_depth: int = 10) -> Dict:
        definitions = self.search_definitions(term, user_id=user_id)
        if not definitions:
            return {'depth': -1, 'is_grounded': False, 'reason': 'No definition found', 'path': []}

        using_terms = json.loads(definitions[0].get('using_terms', '[]'))
        all_primitive = all(
            self.classify_word(t)['tier'] in ['primitive', 'functional']
            for t in using_terms
        )
        return {
            'depth': 1 if all_primitive else 2,
            'is_grounded': True,
            'reason': 'All terms are primitive' if all_primitive else 'Contains derived terms',
            'path': [term]
        }

    # ─── Nodes ────────────────────────────────────────────────────────────────

    def create_node(
        self,
        question: str,
        user_id: str,
        defining_terms: List[str] = None,
        using_terms: List[str] = None,
        parents: List[Dict[str, str]] = None,
        scope: str = None
    ) -> str:
        ph = self._ph()
        node_id = str(uuid.uuid4())
        cur = self._cursor()
        cur.execute(
            f"""INSERT INTO nodes (id, question, defining_terms, using_terms, parents, scope, created_by, created_at)
                VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})""",
            (
                node_id,
                question,
                json.dumps(defining_terms or []),
                json.dumps(using_terms or []),
                json.dumps(parents or []),
                scope or f"personal:{user_id}",
                user_id,
                int(datetime.now().timestamp())
            )
        )
        self._commit()
        return node_id

    def get_node(self, node_id: str) -> Optional[Dict]:
        ph = self._ph()
        cur = self._cursor()
        cur.execute(f"SELECT * FROM nodes WHERE id = {ph}", (node_id,))
        return self._fetchone(cur)

    # ─── Votes ────────────────────────────────────────────────────────────────

    def vote(self, node_id: str, user_id: str, vote: str):
        if vote not in ["yes", "no", "maybe"]:
            raise ValueError(f"Vote must be 'yes', 'no', or 'maybe', got: {vote}")

        ph = self._ph()
        cur = self._cursor()
        now = int(datetime.now().timestamp())

        if self.pg:
            cur.execute(
                f"""INSERT INTO votes (node_id, user_id, vote, voted_at)
                    VALUES ({ph},{ph},{ph},{ph})
                    ON CONFLICT (node_id, user_id) DO UPDATE
                    SET vote = EXCLUDED.vote, voted_at = EXCLUDED.voted_at""",
                (node_id, user_id, vote, now)
            )
        else:
            cur.execute(
                "INSERT OR REPLACE INTO votes (node_id, user_id, vote, voted_at) VALUES (?,?,?,?)",
                (node_id, user_id, vote, now)
            )
        self._commit()

    def get_vote(self, node_id: str, user_id: str) -> Optional[str]:
        ph = self._ph()
        cur = self._cursor()
        cur.execute(f"SELECT vote FROM votes WHERE node_id = {ph} AND user_id = {ph}", (node_id, user_id))
        row = self._fetchone(cur)
        return row['vote'] if row else None

    def get_vote_count(self, node_id: str) -> Dict[str, int]:
        ph = self._ph()
        cur = self._cursor()
        cur.execute(f"SELECT vote, COUNT(*) AS count FROM votes WHERE node_id = {ph} GROUP BY vote", (node_id,))
        counts = {"yes": 0, "no": 0, "maybe": 0}
        for row in self._fetchall(cur):
            counts[row['vote']] = row['count']
        return counts

    def get_user_votes_bulk(self, user_id: str) -> dict:
        """Returns {node_id: vote} for all votes by this user — single query."""
        ph = self._ph()
        cur = self._cursor()
        cur.execute(f"SELECT node_id, vote FROM votes WHERE user_id = {ph}", (user_id,))
        return {row['node_id']: row['vote'] for row in self._fetchall(cur)}

    def get_compare_nodes(self, user_a: str, user_b: str) -> list:
        """All nodes with both users' votes attached."""
        cur = self._cursor()
        cur.execute("SELECT * FROM nodes ORDER BY created_at DESC")
        nodes = self._fetchall(cur)
        votes_a = self.get_user_votes_bulk(user_a)
        votes_b = self.get_user_votes_bulk(user_b)
        result = []
        for n in nodes:
            n['vote_a'] = votes_a.get(n['id'])
            n['vote_b'] = votes_b.get(n['id'])
            n['vote_counts'] = self.get_vote_count(n['id'])
            result.append(n)
        # Only return nodes where at least one user has voted
        voted = [n for n in result if n['vote_a'] or n['vote_b']]
        return voted if voted else result

    # ─── Search ───────────────────────────────────────────────────────────────

    def search_definitions(self, term: str, scope: str = None, user_id: str = None) -> List[Dict]:
        ph = self._ph()
        cur = self._cursor()
        # Use ILIKE for PostgreSQL (case-insensitive), LIKE for SQLite
        like_op = "ILIKE" if self.pg else "LIKE"
        pattern = f'%"{term}"%'

        if user_id and not scope:
            cur.execute(
                f"SELECT * FROM nodes WHERE defining_terms {like_op} {ph} AND scope = {ph}",
                (pattern, f"personal:{user_id}")
            )
            rows = self._fetchall(cur)
            if rows:
                return rows
            scope = "community:%"

        if scope:
            if "%" in scope:
                cur.execute(
                    f"SELECT * FROM nodes WHERE defining_terms {like_op} {ph} AND scope {like_op} {ph}",
                    (pattern, scope)
                )
            else:
                cur.execute(
                    f"SELECT * FROM nodes WHERE defining_terms {like_op} {ph} AND scope = {ph}",
                    (pattern, scope)
                )
        else:
            cur.execute(f"SELECT * FROM nodes WHERE defining_terms {like_op} {ph}", (pattern,))

        return self._fetchall(cur)

    # ─── Timeline ─────────────────────────────────────────────────────────────

    def get_user_timeline(self, user_id: str, vote_filter: str = "yes") -> List[Dict]:
        ph = self._ph()
        cur = self._cursor()
        if vote_filter == "all":
            cur.execute(
                f"""SELECT n.*, v.vote, v.voted_at FROM nodes n
                    JOIN votes v ON n.id = v.node_id
                    WHERE v.user_id = {ph} ORDER BY v.voted_at""",
                (user_id,)
            )
        else:
            cur.execute(
                f"""SELECT n.*, v.vote, v.voted_at FROM nodes n
                    JOIN votes v ON n.id = v.node_id
                    WHERE v.user_id = {ph} AND v.vote = {ph} ORDER BY v.voted_at""",
                (user_id, vote_filter)
            )
        return self._fetchall(cur)

    def get_root_nodes(self, user_id: str) -> List[Dict]:
        ph = self._ph()
        cur = self._cursor()
        cur.execute(
            f"""SELECT n.*, v.vote FROM nodes n
                JOIN votes v ON n.id = v.node_id
                WHERE v.user_id = {ph} AND v.vote = 'yes' AND n.parents = '[]'""",
            (user_id,)
        )
        return self._fetchall(cur)

    def get_children(self, node_id: str, via: str = None, user_id: str = None, voted: str = None) -> List[Dict]:
        ph = self._ph()
        cur = self._cursor()
        like_op = "ILIKE" if self.pg else "LIKE"
        pattern = f'%"id": "{node_id}", "via": "{via}"%' if via else f'%"id": "{node_id}"%'

        if user_id and voted:
            cur.execute(
                f"""SELECT n.*, v.vote FROM nodes n
                    JOIN votes v ON n.id = v.node_id
                    WHERE n.parents {like_op} {ph} AND v.user_id = {ph} AND v.vote = {ph}""",
                (pattern, user_id, voted)
            )
        elif user_id:
            cur.execute(
                f"""SELECT n.*, v.vote FROM nodes n
                    JOIN votes v ON n.id = v.node_id
                    WHERE n.parents {like_op} {ph} AND v.user_id = {ph}""",
                (pattern, user_id)
            )
        else:
            cur.execute(f"SELECT * FROM nodes WHERE parents {like_op} {ph}", (pattern,))
        return self._fetchall(cur)

    def calculate_reachable_nodes(self, user_id: str) -> Set[str]:
        reachable = set()
        queue = [n['id'] for n in self.get_root_nodes(user_id)]
        while queue:
            node_id = queue.pop(0)
            if node_id in reachable:
                continue
            reachable.add(node_id)
            for child in self.get_children(node_id, user_id=user_id, voted="yes"):
                for parent in json.loads(child.get('parents', '[]')):
                    if parent['id'] == node_id and child.get('vote') == 'yes':
                        queue.append(child['id'])
        return reachable

    def get_orphaned_nodes(self, user_id: str) -> List[Dict]:
        timeline = {n['id']: n for n in self.get_user_timeline(user_id, "yes")}
        reachable = self.calculate_reachable_nodes(user_id)
        return [n for nid, n in timeline.items() if nid not in reachable]

    # ─── Stats ────────────────────────────────────────────────────────────────

    def get_stats(self) -> Dict:
        cur = self._cursor()
        cur.execute("SELECT COUNT(*) AS c FROM nodes")
        nodes = self._fetchone(cur)['c']
        cur.execute("SELECT COUNT(*) AS c FROM votes")
        votes = self._fetchone(cur)['c']
        cur.execute("SELECT COUNT(DISTINCT user_id) AS c FROM votes")
        users = self._fetchone(cur)['c']
        return {"nodes": nodes, "votes": votes, "users": users}

    def close(self):
        self.conn.close()


def init_db() -> TimelineDB:
    return TimelineDB()
