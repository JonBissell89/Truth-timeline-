"""
AI Suggestion Engine for Truth Timeline

Generates helpful yes/no questions to define terms.

FUTURE: Integrate with LLM API for dynamic suggestions.
For now, uses template-based suggestions.
"""

from typing import List, Dict


def suggest_definitions(term: str, count: int = 3) -> List[str]:
    """
    Generate suggested yes/no questions for defining a term.

    Args:
        term: The term to define (e.g., "I", "consciousness", "freedom")
        count: Number of suggestions to generate

    Returns:
        List of suggested yes/no questions
    """
    # Template-based suggestions
    templates = {
        # Foundational philosophical terms
        "I": [
            f"Is {term} = individual consciousness?",
            f"Is {term} = the physical body?",
            f"Is {term} = continuous identity over time?",
            f"Is {term} = the observer of thoughts?",
            f"Is {term} = a social construct?"
        ],
        "consciousness": [
            f"Is {term} = subjective experience?",
            f"Is {term} = self-awareness?",
            f"Is {term} = the ability to perceive?",
            f"Is {term} = emergent from brain activity?",
            f"Is {term} = fundamental to reality?"
        ],
        "think": [
            f"Is {term} = processing information?",
            f"Is {term} = having thoughts?",
            f"Is {term} = rational reasoning?",
            f"Is {term} = being aware of thinking?",
            f"Is {term} = manipulating concepts?"
        ],
        "am": [
            f"Is {term} = to exist?",
            f"Is {term} = to have being?",
            f"Is {term} = to be present in reality?",
            f"Is {term} = to persist through time?",
            f"Is {term} = to be experienced?"
        ],
        "freedom": [
            f"Is {term} = ability to choose?",
            f"Is {term} = absence of constraint?",
            f"Is {term} = self-determination?",
            f"Is {term} = political liberty?",
            f"Is {term} = free will?"
        ],
        "choice": [
            f"Is {term} = selecting between options?",
            f"Is {term} = exercising will?",
            f"Is {term} = making a decision?",
            f"Is {term} = caused by reasons?",
            f"Is {term} = uncaused action?"
        ],
        "reality": [
            f"Is {term} = objective existence?",
            f"Is {term} = what we perceive?",
            f"Is {term} = independent of mind?",
            f"Is {term} = consensus agreement?",
            f"Is {term} = all that exists?"
        ],
        "truth": [
            f"Is {term} = correspondence to reality?",
            f"Is {term} = what can be proven?",
            f"Is {term} = consensus belief?",
            f"Is {term} = coherent with other beliefs?",
            f"Is {term} = useful belief?"
        ]
    }

    # Check if we have specific suggestions for this term
    if term.lower() in templates:
        suggestions = templates[term.lower()][:count]
    else:
        # Generic templates for unknown terms
        suggestions = [
            f"Is {term} = [core property]?",
            f"Is {term} = [essential characteristic]?",
            f"Is {term} = [primary attribute]?"
        ]

    return suggestions


def suggest_next_question(user_timeline: List[Dict]) -> List[str]:
    """
    Suggest next logical questions based on user's timeline.

    Args:
        user_timeline: User's current timeline (list of voted-yes nodes)

    Returns:
        List of suggested next questions to explore

    FUTURE: Use ML to find common question paths and suggest unexplored branches.
    """
    # For now, return some general philosophical questions
    suggestions = [
        "Does free will exist?",
        "Is morality objective or subjective?",
        "Is knowledge possible?",
        "Does meaning exist inherently or is it constructed?",
        "Is the mind separate from the body?"
    ]

    return suggestions[:3]


def analyze_question_complexity(question: str) -> Dict[str, any]:
    """
    Analyze a question's complexity and suggest if it should be a project.

    Args:
        question: The proposed question

    Returns:
        Dict with analysis:
        - is_binary: Can this be answered yes/no?
        - complexity_score: 0-10 scale
        - suggest_project: Should this be a project instead?
        - reason: Why it might need to be a project

    FUTURE: Use NLP to detect questions that are too complex for binary choice.
    """
    # Simple heuristics for now
    word_count = len(question.split())
    has_multiple_questions = "?" in question[:-1]  # Multiple ? marks
    has_conditional = any(word in question.lower() for word in ["if", "when", "depending"])

    complexity_score = 0
    if word_count > 15:
        complexity_score += 3
    if has_multiple_questions:
        complexity_score += 5
    if has_conditional:
        complexity_score += 4

    suggest_project = complexity_score > 6

    reason = ""
    if suggest_project:
        if has_multiple_questions:
            reason = "Contains multiple questions - consider breaking into separate nodes or creating a project"
        elif has_conditional:
            reason = "Contains conditionals - may need project to explore different scenarios"
        elif word_count > 15:
            reason = "Question is complex - consider simplifying or creating a project to explore nuances"

    return {
        "is_binary": not has_multiple_questions,
        "complexity_score": complexity_score,
        "suggest_project": suggest_project,
        "reason": reason
    }


# FUTURE ENHANCEMENTS:
"""
1. LLM Integration:
   - Use GPT/Claude API to generate contextual suggestions
   - Analyze user's timeline to suggest coherent next questions
   - Detect term definitions automatically from questions

2. Community Learning:
   - Learn from popular community question patterns
   - Suggest questions that led to interesting discussions
   - Find "question clusters" (related definitions)

3. Ontology Awareness:
   - Build knowledge graph of term dependencies
   - Suggest definitions in logical order (foundational first)
   - Detect circular definitions

4. Project Detection:
   - Use NLP to detect questions too complex for yes/no
   - Suggest breaking questions into sub-questions
   - Auto-generate project structure for complex topics

5. Personalization:
   - Learn user's philosophical stance from timeline
   - Suggest questions that challenge or expand their worldview
   - Adapt suggestion style to user's preferences
"""
