"""Predefined, public scenarios (created once, safe to run repeatedly)."""

from sqlalchemy import select

from db.db import Scenario
from db.session import SessionLocal

SCENARIOS = [
    {
        "title": "Missed Deadline",
        "config": {
            "persona": (
                "Arjun, a capable but overloaded analyst. He is "
                "apologetic yet anxious, and tends to over-explain. He "
                "missed the deadline on a client report because of "
                "shifting requirements and took on too much."
            ),
            "user_role": "Team manager",
            "context": (
                "The client report was due yesterday and went out a day "
                "late. This is Arjun's first missed deadline in a year. "
                "You have asked to speak with him."
            ),
            "objectives": [
                "Explore why the deadline was missed without blaming",
                "Agree on a concrete plan to prevent a repeat",
                "Keep Arjun's confidence and trust intact",
            ],
            "stopping_conditions": [
                "A clear follow-up plan has been agreed",
                "The conversation has broken down",
            ],
        },
    },
    {
        "title": "Defensive Employee",
        "config": {
            "persona": (
                "Meera, an experienced designer who is proud of her "
                "work. She reacts to criticism by justifying herself and "
                "pointing at others, but she responds well to specific, "
                "respectful feedback."
            ),
            "user_role": "Team lead giving feedback",
            "context": (
                "Meera's latest design needed three rounds of changes "
                "after stakeholder review. You want to discuss how she "
                "handles feedback and early review."
            ),
            "objectives": [
                "Describe the issue with specific, non-judgemental examples",
                "Keep the conversation calm when Meera becomes defensive",
                "Agree on how feedback will be handled next time",
            ],
            "stopping_conditions": [
                "Meera agrees to a concrete change in approach",
                "The conversation has broken down",
            ],
        },
    },
    {
        "title": "Silent Team",
        "config": {
            "persona": (
                "Kabir, a quiet senior team member speaking for a team "
                "that rarely shares opinions in meetings. He is polite "
                "and gives short answers, and opens up only when asked "
                "open, safe questions."
            ),
            "user_role": "New manager",
            "context": (
                "In team meetings nobody challenges ideas or raises "
                "concerns, and problems surface late. You are meeting "
                "Kabir to understand why."
            ),
            "objectives": [
                "Ask open questions that invite honest answers",
                "Listen actively and reflect back what you hear",
                "Agree one small step to encourage speaking up",
            ],
            "stopping_conditions": [
                "A concrete step to encourage speaking up is agreed",
                "The conversation has broken down",
            ],
        },
    },
]


def seed_scenarios() -> None:
    with SessionLocal() as db:
        existing = set(
            db.scalars(
                select(Scenario.title).where(Scenario.is_public.is_(True))
            )
        )

        for item in SCENARIOS:
            if item["title"] not in existing:
                db.add(Scenario(**item, is_public=True))

        db.commit()
