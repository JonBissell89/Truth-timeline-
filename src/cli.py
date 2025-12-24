#!/usr/bin/env python3
"""
Truth Timeline CLI

Interactive command-line interface for exploring and building your personal timeline.
"""

import sys
import json
import re
from typing import List, Set
from db import TimelineDB
from ai_suggest import suggest_definitions, analyze_question_complexity


class TimelineCLI:
    """Interactive CLI for Truth Timeline."""

    def __init__(self, user_id: str):
        """Initialize CLI with user ID and database."""
        self.user_id = user_id
        self.db = TimelineDB()
        self.current_node = None

    def extract_terms(self, question: str) -> List[str]:
        """
        Extract potential terms from a question.

        Simple extraction: split on spaces and punctuation, filter common words.
        """
        # Remove punctuation and split
        words = re.findall(r'\b[a-zA-Z]+\b', question)

        # Filter out common words (very basic)
        common = {
            'is', 'are', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'on',
            'at', 'by', 'with', 'from', 'as', 'into', 'that', 'this',
            'does', 'do', 'can', 'will', 'would', 'should', 'could'
        }

        terms = [w.lower() for w in words if w.lower() not in common]

        return list(set(terms))  # Remove duplicates

    def find_undefined_terms(self, terms: List[str]) -> List[str]:
        """Find terms that are not defined in user's timeline or community."""
        undefined = []

        for term in terms:
            # Check personal definitions first
            personal = self.db.search_definitions(term, user_id=self.user_id)

            if not personal:
                # Check community definitions
                community = self.db.search_definitions(term, scope="community:%")

                if not community:
                    undefined.append(term)

        return undefined

    def display_node(self, node: dict, show_vote: bool = True):
        """Display a node with formatting."""
        print(f"\n{'='*60}")
        print(f"Question: {node['question']}")
        print(f"ID: {node['id']}")

        # Parse JSON fields
        defining = json.loads(node.get('defining_terms', '[]'))
        if defining:
            print(f"Defines: {', '.join(defining)}")

        parents = json.loads(node.get('parents', '[]'))
        if parents:
            print(f"Parents: {len(parents)} node(s)")

        # Vote counts
        counts = self.db.get_vote_count(node['id'])
        print(f"Votes: {counts['yes']} yes, {counts['no']} no")

        # User's vote
        if show_vote:
            user_vote = self.db.get_vote(node['id'], self.user_id)
            if user_vote:
                print(f"Your vote: {user_vote.upper()}")
            else:
                print(f"Your vote: (not voted)")

        print(f"{'='*60}\n")

    def ask_question(self, question: str, defining_term: str = None):
        """
        Ask a new question (create a node).

        Args:
            question: The yes/no question
            defining_term: Optional term this question defines
        """
        # Extract all terms used in question
        using_terms = self.extract_terms(question)

        # Check for undefined terms
        undefined = self.find_undefined_terms(using_terms)

        if undefined:
            print(f"\n⚠️  Warning: Undefined terms detected: {', '.join(undefined)}")
            print("You should define these terms first for a complete timeline.")
            response = input("Continue anyway? (y/n): ")
            if response.lower() != 'y':
                return None

        # Create node
        defining_terms = [defining_term] if defining_term else []

        node_id = self.db.create_node(
            question=question,
            user_id=self.user_id,
            defining_terms=defining_terms,
            using_terms=using_terms,
            parents=[],  # For now, no parent linking in CLI
            scope=f"personal:{self.user_id}"
        )

        print(f"\n✓ Created node: {node_id}")

        # Prompt for vote
        node = self.db.get_node(node_id)
        self.display_node(node, show_vote=False)

        vote = input("Your vote (yes/no): ").lower()
        if vote in ['yes', 'no']:
            self.db.vote(node_id, self.user_id, vote)
            print(f"✓ Voted {vote.upper()}")

        return node_id

    def define_term(self, term: str):
        """Interactive flow to define a term."""
        print(f"\n🔍 Searching for definitions of '{term}'...")

        # Check personal
        personal = self.db.search_definitions(term, user_id=self.user_id)
        if personal:
            print(f"\n✓ You already defined '{term}':")
            for node in personal:
                self.display_node(node)
            return

        # Check community
        community = self.db.search_definitions(term, scope="community:%")

        if community:
            print(f"\n📚 Found {len(community)} community definition(s):\n")
            for i, node in enumerate(community, 1):
                print(f"[{i}] {node['question']}")

            print(f"\nOptions:")
            print(f"  [1-{len(community)}] Vote on community definition")
            print(f"  [c] Create custom definition")
            print(f"  [s] Skip for now")

            choice = input("\nChoice: ").lower()

            if choice == 'c':
                # Create custom
                self._create_custom_definition(term)
            elif choice == 's':
                return
            elif choice.isdigit() and 1 <= int(choice) <= len(community):
                # Vote on community definition
                node = community[int(choice) - 1]
                self.display_node(node, show_vote=False)
                vote = input("Your vote (yes/no): ").lower()
                if vote in ['yes', 'no']:
                    self.db.vote(node['id'], self.user_id, vote)
                    print(f"✓ Voted {vote.upper()}")
        else:
            # No definitions found
            print(f"\n❌ No definitions found for '{term}'")
            print(f"\nWe need to create one.")
            self._create_custom_definition(term)

    def _create_custom_definition(self, term: str):
        """Helper to create a custom definition."""
        # Get AI suggestions
        ai_suggestions = suggest_definitions(term, count=3)

        print(f"\n🤖 AI Suggestions for defining '{term}':")
        for i, suggestion in enumerate(ai_suggestions, 1):
            print(f"  [{i}] {suggestion}")
        print(f"  [c] Write custom question")

        choice = input("\nChoice: ").lower()

        # Build suggestions dict
        suggestions = {str(i+1): s for i, s in enumerate(ai_suggestions)}

        if choice in suggestions:
            question = suggestions[choice]
        elif choice == 'c':
            question = input(f"Enter yes/no question defining '{term}': ")
        else:
            return

        # Create the definition node
        self.ask_question(question, defining_term=term)

    def view_timeline(self):
        """Display user's timeline (all yes votes)."""
        timeline = self.db.get_user_timeline(self.user_id, vote_filter="yes")

        if not timeline:
            print("\n📭 Your timeline is empty. Start by defining fundamental terms!")
            return

        print(f"\n🌟 Your Timeline ({len(timeline)} decisions)\n")

        for node in timeline:
            print(f"  • {node['question']}")
            defining = json.loads(node.get('defining_terms', '[]'))
            if defining:
                print(f"    Defines: {', '.join(defining)}")

        # Check for orphaned nodes
        orphaned = self.db.get_orphaned_nodes(self.user_id)
        if orphaned:
            print(f"\n⚠️  Warning: {len(orphaned)} orphaned node(s) detected!")
            print("These nodes are no longer reachable due to changed votes.")

    def main_menu(self):
        """Main interactive menu."""
        print("\n" + "="*60)
        print("Truth Timeline - Build Your Reality".center(60))
        print("="*60)
        print(f"\nUser: {self.user_id}\n")

        while True:
            print("\nOptions:")
            print("  [1] Define a term")
            print("  [2] Ask a question")
            print("  [3] View my timeline")
            print("  [4] Search definitions")
            print("  [q] Quit")

            choice = input("\nChoice: ").lower()

            if choice == '1':
                term = input("Term to define: ")
                self.define_term(term)
            elif choice == '2':
                question = input("Enter yes/no question: ")
                self.ask_question(question)
            elif choice == '3':
                self.view_timeline()
            elif choice == '4':
                term = input("Search for term: ")
                results = self.db.search_definitions(term, user_id=self.user_id)
                if results:
                    print(f"\n📚 Found {len(results)} definition(s):\n")
                    for node in results:
                        self.display_node(node)
                else:
                    print(f"\n❌ No definitions found for '{term}'")
            elif choice == 'q':
                print("\n👋 Exiting Truth Timeline")
                break
            else:
                print("Invalid choice")

    def bootstrap_first_user(self):
        """Special flow for the very first user - define foundational terms."""
        print("\n" + "="*60)
        print("Welcome, First User!".center(60))
        print("="*60)
        print("\nYou are starting from the ground floor.")
        print("To ask 'I think therefore I am', we must first define:")
        print("  • I")
        print("  • think")
        print("  • therefore")
        print("  • am")
        print("\nLet's begin with the most fundamental: 'I'\n")

        # Define "I"
        self.define_term("I")

        print("\n✓ Great start! You can now continue defining other terms.")
        print("Use the main menu to build your reality from first principles.")


def main():
    """Entry point for CLI."""
    if len(sys.argv) > 1:
        user_id = sys.argv[1]
    else:
        user_id = input("Enter your user ID: ")

    cli = TimelineCLI(user_id)

    # Check if user is first user (no nodes in database)
    db = TimelineDB()
    cursor = db.conn.cursor()
    node_count = cursor.execute("SELECT COUNT(*) as count FROM nodes").fetchone()['count']

    if node_count == 0:
        print("\n🌟 You are the first user!")
        choice = input("Start with bootstrap flow? (y/n): ")
        if choice.lower() == 'y':
            cli.bootstrap_first_user()

    cli.main_menu()


if __name__ == "__main__":
    main()
