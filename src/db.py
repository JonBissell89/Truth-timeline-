"""
Database layer for Truth Timeline.

Simple SQLite wrapper with functions for:
- Creating nodes (questions/definitions)
- Voting on nodes
- Searching for term definitions
- Getting user timelines
- Calculating timeline validity
"""

import sqlite3
import json
import uuid
import os
from typing import List, Dict, Optional, Set
from datetime import datetime


class TimelineDB:
    """SQLite database for Truth Timeline."""

    def __init__(self, db_path: str = "data/timeline.db"):
        """Initialize database connection and create schema if needed."""
        self.db_path = db_path

        # Create directory if it doesn't exist
        db_dir = os.path.dirname(db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir)

        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row  # Access columns by name
        self._create_schema()

    def _create_schema(self):
        """Create tables and indexes if they don't exist."""
        cursor = self.conn.cursor()

        # Nodes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                question TEXT NOT NULL,
                defining_terms TEXT,
                using_terms TEXT,
                parents TEXT,
                scope TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
        """)

        # Votes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                node_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                vote TEXT NOT NULL,
                voted_at INTEGER NOT NULL,
                PRIMARY KEY (node_id, user_id),
                FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
            )
        """)

        # Word classification table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS word_classes (
                word TEXT PRIMARY KEY,
                tier TEXT NOT NULL,
                definition_type TEXT,
                image_url TEXT,
                primitive_decomposition TEXT,
                notes TEXT
            )
        """)

        # Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_scope ON nodes(scope)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_defining ON nodes(defining_terms)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_using ON nodes(using_terms)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_votes_node ON votes(node_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_word_tier ON word_classes(tier)")

        self.conn.commit()

        # Load semantic primitives if not already loaded
        self._load_primitives()

    def _load_primitives(self):
        """Load semantic primitives from JSON file if not already in database."""
        cursor = self.conn.cursor()

        # Check if primitives already loaded
        count = cursor.execute("SELECT COUNT(*) as c FROM word_classes WHERE tier = 'primitive'").fetchone()['c']
        if count > 0:
            return  # Already loaded

        # Load from JSON file
        primitives_path = os.path.join(os.path.dirname(__file__), 'semantic_primitives.json')
        if not os.path.exists(primitives_path):
            return  # File not found, skip

        with open(primitives_path, 'r') as f:
            data = json.load(f)

        # Insert primitives
        for word, info in data.get('primitives', {}).items():
            cursor.execute("""
                INSERT OR IGNORE INTO word_classes (word, tier, definition_type, notes)
                VALUES (?, ?, ?, ?)
            """, (word.lower(), info['tier'], info['type'], info.get('notes', '')))

        # Insert functional words
        for word, info in data.get('functional', {}).items():
            cursor.execute("""
                INSERT OR IGNORE INTO word_classes (word, tier, definition_type)
                VALUES (?, ?, ?)
            """, (word.lower(), info['tier'], info['type']))

        self.conn.commit()

    def classify_word(self, word: str) -> Dict:
        """
        Classify a word into its tier.

        Returns:
            Dict with tier, type, and whether it needs definition
        """
        word_lower = word.lower()

        # Check database first
        cursor = self.conn.cursor()
        result = cursor.execute(
            "SELECT * FROM word_classes WHERE word = ?",
            (word_lower,)
        ).fetchone()

        if result:
            return {
                'word': word_lower,
                'tier': result['tier'],
                'type': result['definition_type'],
                'needs_definition': result['tier'] not in ['primitive', 'functional']
            }

        # Check if it's a known subjective word
        primitives_path = os.path.join(os.path.dirname(__file__), 'semantic_primitives.json')
        if os.path.exists(primitives_path):
            with open(primitives_path, 'r') as f:
                data = json.load(f)
                if word_lower in data.get('subjective_markers', []):
                    return {
                        'word': word_lower,
                        'tier': 'subjective',
                        'type': 'personal',
                        'needs_definition': True
                    }

        # Unknown word - classify as derived (needs definition)
        return {
            'word': word_lower,
            'tier': 'derived',
            'type': 'unknown',
            'needs_definition': True
        }

    def get_word_tier(self, word: str) -> str:
        """Get the tier of a word (primitive, functional, concrete, derived, subjective)."""
        classification = self.classify_word(word)
        return classification['tier']

    def get_undefined_terms(self, terms: List[str], user_id: str) -> List[Dict]:
        """
        Check which terms are undefined for a user.

        Returns list of dicts with term info and classification.
        """
        undefined = []

        for term in terms:
            classification = self.classify_word(term)

            # Skip functional words
            if classification['tier'] == 'functional':
                continue

            # Primitives don't need definition
            if classification['tier'] == 'primitive':
                continue

            # Check if user has defined this term
            personal_defs = self.search_definitions(term, user_id=user_id)

            if not personal_defs:
                # Check community definitions
                community_defs = self.search_definitions(term, scope="community:%")

                undefined.append({
                    'term': term,
                    'classification': classification,
                    'community_definitions': len(community_defs),
                    'suggested_action': 'define' if community_defs == 0 else 'vote_or_define'
                })

        return undefined

    def detect_circular_definition(self, term: str, question: str, max_depth: int = 10) -> Dict:
        """
        Detect if defining 'term' with 'question' creates a circular definition.

        Returns dict with is_circular flag and path if circular.
        """
        # Extract words from question
        words = question.lower().split()

        # Check if term appears in its own definition
        if term.lower() in words:
            return {
                'is_circular': True,
                'reason': f'Direct self-reference: "{term}" appears in its own definition',
                'path': [term, term]
            }

        # Check for indirect cycles (term A → B → C → A)
        # This requires checking the definition chain
        visited = set()
        path = [term]

        def check_chain(current_term, depth=0):
            if depth > max_depth:
                return False

            if current_term in visited:
                return True  # Found cycle

            visited.add(current_term)

            # Get definitions of current_term
            # (simplified - in real implementation would parse using_terms from existing definitions)
            return False

        # For now, just check direct self-reference
        # Full cycle detection would require analyzing the full definition graph

        return {
            'is_circular': False,
            'reason': None,
            'path': []
        }

    def calculate_definition_depth(self, term: str, user_id: str, max_depth: int = 10) -> Dict:
        """
        Calculate how many steps to reach primitives from this term.

        Returns dict with depth, path to primitives, and grounding status.
        """
        # Get user's definition of this term
        definitions = self.search_definitions(term, user_id=user_id)

        if not definitions:
            return {
                'depth': -1,
                'is_grounded': False,
                'reason': 'No definition found',
                'path': []
            }

        # Get the first definition (user's primary definition)
        definition = definitions[0]
        using_terms = json.loads(definition.get('using_terms', '[]'))

        # Check if all using terms are primitives or functional
        all_primitive = True
        max_term_depth = 0
        path = [term]

        for using_term in using_terms:
            classification = self.classify_word(using_term)

            if classification['tier'] in ['primitive', 'functional']:
                continue
            else:
                all_primitive = False
                # Would recursively check depth of using_term here
                max_term_depth = max(max_term_depth, 1)

        if all_primitive:
            return {
                'depth': 1,
                'is_grounded': True,
                'reason': 'All terms are primitive',
                'path': path
            }
        else:
            return {
                'depth': max_term_depth + 1,
                'is_grounded': True,  # Assume grounded if we haven't hit max_depth
                'reason': 'Contains derived terms',
                'path': path
            }

    def create_node(
        self,
        question: str,
        user_id: str,
        defining_terms: List[str] = None,
        using_terms: List[str] = None,
        parents: List[Dict[str, str]] = None,
        scope: str = None
    ) -> str:
        """
        Create a new decision node.

        Args:
            question: The yes/no question
            user_id: User creating the node
            defining_terms: Terms this node defines (e.g., ["I"])
            using_terms: All terms used in question (e.g., ["I", "consciousness"])
            parents: Parent nodes [{"id": "xyz", "via": "yes"}]
            scope: "personal:user123", "community:xyz", or "global"

        Returns:
            Node ID (UUID)
        """
        node_id = str(uuid.uuid4())
        defining_terms = defining_terms or []
        using_terms = using_terms or []
        parents = parents or []
        scope = scope or f"personal:{user_id}"

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO nodes (id, question, defining_terms, using_terms, parents, scope, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            node_id,
            question,
            json.dumps(defining_terms),
            json.dumps(using_terms),
            json.dumps(parents),
            scope,
            user_id,
            int(datetime.now().timestamp())
        ))
        self.conn.commit()

        return node_id

    def vote(self, node_id: str, user_id: str, vote: str):
        """
        Vote on a node (yes or no).

        Args:
            node_id: Node to vote on
            user_id: User voting
            vote: "yes" or "no"
        """
        if vote not in ["yes", "no"]:
            raise ValueError(f"Vote must be 'yes' or 'no', got: {vote}")

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO votes (node_id, user_id, vote, voted_at)
            VALUES (?, ?, ?, ?)
        """, (node_id, user_id, vote, int(datetime.now().timestamp())))
        self.conn.commit()

    def get_vote(self, node_id: str, user_id: str) -> Optional[str]:
        """Get user's vote on a node (returns 'yes', 'no', or None)."""
        cursor = self.conn.cursor()
        result = cursor.execute(
            "SELECT vote FROM votes WHERE node_id = ? AND user_id = ?",
            (node_id, user_id)
        ).fetchone()
        return result['vote'] if result else None

    def search_definitions(
        self,
        term: str,
        scope: str = None,
        user_id: str = None
    ) -> List[Dict]:
        """
        Search for definitions of a term.

        Args:
            term: Term to search for (e.g., "I", "consciousness")
            scope: Filter by scope ("personal:user123", "community:xyz", "global")
            user_id: If provided, searches personal scope first, then community

        Returns:
            List of nodes that define this term
        """
        cursor = self.conn.cursor()

        # Search pattern for JSON array
        pattern = f'%"{term}"%'

        if user_id and not scope:
            # Search personal first, then community
            personal_results = cursor.execute(
                "SELECT * FROM nodes WHERE defining_terms LIKE ? AND scope = ?",
                (pattern, f"personal:{user_id}")
            ).fetchall()

            if personal_results:
                return [dict(row) for row in personal_results]

            # Fall back to community
            scope = "community:%"

        if scope:
            if "%" in scope:
                results = cursor.execute(
                    "SELECT * FROM nodes WHERE defining_terms LIKE ? AND scope LIKE ?",
                    (pattern, scope)
                ).fetchall()
            else:
                results = cursor.execute(
                    "SELECT * FROM nodes WHERE defining_terms LIKE ? AND scope = ?",
                    (pattern, scope)
                ).fetchall()
        else:
            results = cursor.execute(
                "SELECT * FROM nodes WHERE defining_terms LIKE ?",
                (pattern,)
            ).fetchall()

        return [dict(row) for row in results]

    def get_user_timeline(self, user_id: str, vote_filter: str = "yes") -> List[Dict]:
        """
        Get all nodes in user's timeline (nodes they voted on).

        Args:
            user_id: User ID
            vote_filter: "yes", "no", or "all"

        Returns:
            List of nodes with vote information
        """
        cursor = self.conn.cursor()

        if vote_filter == "all":
            query = """
                SELECT n.*, v.vote, v.voted_at
                FROM nodes n
                JOIN votes v ON n.id = v.node_id
                WHERE v.user_id = ?
                ORDER BY v.voted_at
            """
            params = (user_id,)
        else:
            query = """
                SELECT n.*, v.vote, v.voted_at
                FROM nodes n
                JOIN votes v ON n.id = v.node_id
                WHERE v.user_id = ? AND v.vote = ?
                ORDER BY v.voted_at
            """
            params = (user_id, vote_filter)

        results = cursor.execute(query, params).fetchall()
        return [dict(row) for row in results]

    def get_children(
        self,
        node_id: str,
        via: str = None,
        user_id: str = None,
        voted: str = None
    ) -> List[Dict]:
        """
        Get child nodes (nodes that have this node as a parent).

        Args:
            node_id: Parent node ID
            via: Filter by path ("yes" or "no")
            user_id: If provided, only return nodes user voted on
            voted: If provided with user_id, filter by vote ("yes" or "no")

        Returns:
            List of child nodes
        """
        cursor = self.conn.cursor()

        # Build search pattern
        if via:
            pattern = f'%"id": "{node_id}", "via": "{via}"%'
        else:
            pattern = f'%"id": "{node_id}"%'

        if user_id:
            if voted:
                query = """
                    SELECT n.*, v.vote
                    FROM nodes n
                    JOIN votes v ON n.id = v.node_id
                    WHERE n.parents LIKE ?
                      AND v.user_id = ?
                      AND v.vote = ?
                """
                params = (pattern, user_id, voted)
            else:
                query = """
                    SELECT n.*, v.vote
                    FROM nodes n
                    JOIN votes v ON n.id = v.node_id
                    WHERE n.parents LIKE ?
                      AND v.user_id = ?
                """
                params = (pattern, user_id)
        else:
            query = "SELECT * FROM nodes WHERE parents LIKE ?"
            params = (pattern,)

        results = cursor.execute(query, params).fetchall()
        return [dict(row) for row in results]

    def get_root_nodes(self, user_id: str) -> List[Dict]:
        """
        Get root nodes for user (nodes with no parents that user voted yes on).

        Args:
            user_id: User ID

        Returns:
            List of root nodes
        """
        cursor = self.conn.cursor()
        results = cursor.execute("""
            SELECT n.*, v.vote
            FROM nodes n
            JOIN votes v ON n.id = v.node_id
            WHERE v.user_id = ?
              AND v.vote = 'yes'
              AND n.parents = '[]'
        """, (user_id,)).fetchall()

        return [dict(row) for row in results]

    def calculate_reachable_nodes(self, user_id: str) -> Set[str]:
        """
        Calculate all nodes reachable from user's yes votes.

        Uses BFS from root nodes, following only yes-voted paths.

        Args:
            user_id: User ID

        Returns:
            Set of reachable node IDs
        """
        reachable = set()
        queue = [node['id'] for node in self.get_root_nodes(user_id)]

        while queue:
            node_id = queue.pop(0)
            if node_id in reachable:
                continue

            reachable.add(node_id)

            # Get children where user voted yes
            children = self.get_children(node_id, user_id=user_id, voted="yes")
            for child in children:
                # Check that user's vote path matches parent link
                parents = json.loads(child['parents'])
                user_vote = child.get('vote')

                # Find the parent link for current node
                for parent in parents:
                    if parent['id'] == node_id and user_vote == 'yes':
                        queue.append(child['id'])

        return reachable

    def get_orphaned_nodes(self, user_id: str) -> List[Dict]:
        """
        Find nodes in user's timeline that are no longer reachable.

        These are nodes where user voted yes, but changing an upstream
        vote broke the path to them.

        Args:
            user_id: User ID

        Returns:
            List of orphaned nodes
        """
        timeline_nodes = {node['id']: node for node in self.get_user_timeline(user_id, "yes")}
        reachable = self.calculate_reachable_nodes(user_id)

        orphaned = []
        for node_id, node in timeline_nodes.items():
            if node_id not in reachable:
                orphaned.append(node)

        return orphaned

    def get_node(self, node_id: str) -> Optional[Dict]:
        """Get a single node by ID."""
        cursor = self.conn.cursor()
        result = cursor.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
        return dict(result) if result else None

    def get_vote_count(self, node_id: str) -> Dict[str, int]:
        """Get vote counts for a node."""
        cursor = self.conn.cursor()
        results = cursor.execute(
            "SELECT vote, COUNT(*) as count FROM votes WHERE node_id = ? GROUP BY vote",
            (node_id,)
        ).fetchall()

        counts = {"yes": 0, "no": 0}
        for row in results:
            counts[row['vote']] = row['count']

        return counts

    def close(self):
        """Close database connection."""
        self.conn.close()


# Convenience functions for CLI
def init_db(db_path: str = "data/timeline.db") -> TimelineDB:
    """Initialize and return database instance."""
    return TimelineDB(db_path)
