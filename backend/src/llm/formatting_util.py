"""Formatting and parsing for LLM inputs and outputs.

Turns stored messages and scenarios into prompt text, and model output back
into app data. The agents only deal with prompts and workflow.
"""

import json
import re
from typing import TypeVar

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from pydantic import BaseModel

from models.evaluation import EvaluationReport

T = TypeVar("T", bound=BaseModel)

END_MARKER = "[[END]]"  # the character writes this when the scenario ends
# The only reply given to off-topic, unsafe or instruction-changing messages.
REFUSAL = "I'm sorry, but I can't help with that."
CAVEAT = (
    "These Transactional Analysis observations are tentative cues from a "
    "single practice conversation. They are not a diagnosis and do not "
    "describe a fixed personality or anyone's hidden motives."
)
MAX_HISTORY = 24  # keeps prompts small for rate-limited models
MAX_TRANSCRIPT_MESSAGES = 40


# Prompt inputs


def render_scenario(snapshot: dict) -> str:
    title = snapshot.get("title", "Workplace conversation")
    config = json.dumps(snapshot.get("config", {}), indent=2)

    return f"Title: {title}\n{config}"


def scenario_brief(data) -> str:
    """The learner's answers, tagged for the scenario designer prompt."""
    goals = "\n".join(f"<goal>{goal}</goal>" for goal in data.goals)
    parts = [
        f"<title>{data.title}</title>",
        f"<what_happened>{data.situation}</what_happened>",
        f"<you_are>{data.user_role}</you_are>",
        f"<character>{data.ai_role}</character>",
        f"<goals>\n{goals}\n</goals>",
    ]

    if data.current is not None:
        parts.append(f"<current_draft>{json.dumps(data.current.model_dump(), indent=2)}</current_draft>")

    if data.feedback:
        parts.append(f"<feedback>{data.feedback}</feedback>")

    return "\n".join(parts)


def to_chat_messages(history) -> list[BaseMessage]:
    """Recent stored messages as chat messages, oldest first."""
    messages: list[BaseMessage] = []

    for item in history[-MAX_HISTORY:]:
        cls = HumanMessage if item.role == "user" else AIMessage
        messages.append(cls(item.content))

    return messages


def is_refusal(text: str) -> bool:
    return text.strip() == REFUSAL


def _on_topic(messages: list) -> list:
    """Drop refused exchanges: the learner's message and the refusal to it.

    Off-topic chatter is not part of the practice, so the report and the
    coach never analyse it.
    """
    kept: list = []

    for item in messages:
        if item.role == "assistant" and is_refusal(item.content):
            if kept and kept[-1].role == "user":
                kept.pop()
            continue

        kept.append(item)

    return kept


def build_transcript(messages) -> tuple[str, dict[str, object]]:
    """Return a labelled transcript and a label -> message map."""
    recent = _on_topic(list(messages))[-MAX_TRANSCRIPT_MESSAGES:]
    labels = {f"m{i}": m for i, m in enumerate(recent, start=1)}
    lines = [
        f"{label} [{'USER' if m.role == 'user' else 'AI'}]: {m.content}"
        for label, m in labels.items()
    ]

    return "\n".join(lines), labels


# Model output


def text_of(message) -> str:
    """Text of a message or streamed chunk; other content blocks are skipped."""
    content = message.content

    if isinstance(content, str):
        return content

    return "".join(
        block.get("text", "")
        for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    )


def last_text(result: dict) -> str:
    """Text of the final message in an agent run."""
    return text_of(result["messages"][-1])


_DASH = re.compile(r"\s*[—–]\s*")


def plain_punctuation(text: str) -> str:
    """Replace em and en dashes with a comma, the way a person would write it."""
    return _DASH.sub(", ", text)


def strip_end_marker(text: str) -> str:
    return plain_punctuation(text.replace(END_MARKER, "")).strip()


def hold_back_partial_marker(text: str) -> tuple[str, str]:
    """Split off a possible start of END_MARKER so it is never shown."""
    for size in range(min(len(END_MARKER) - 1, len(text)), 0, -1):
        if END_MARKER.startswith(text[-size:]):
            return text[:-size], text[-size:]

    return text, ""


def structured(result: dict, schema: type[T]) -> T:
    """The validated response from an agent built with `response_format`."""
    value = result.get("structured_response")

    if value is None:
        raise RuntimeError("The model returned no structured response")

    if isinstance(value, schema):
        value = value.model_dump()

    return schema.model_validate(_plain_strings(value))


def _plain_strings(node):
    """Apply plain_punctuation to every string in a structured response."""
    if isinstance(node, str):
        return plain_punctuation(node)
    if isinstance(node, dict):
        return {key: _plain_strings(item) for key, item in node.items()}
    if isinstance(node, list):
        return [_plain_strings(item) for item in node]
    return node


# Evidence checks for the TA report


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip(" \"'.,;:!?").lower()


def ground_report(
    report: EvaluationReport, labels: dict[str, object]
) -> EvaluationReport:
    """Keep only evidence that really exists; swap labels for message ids."""
    data = report.model_copy(deep=True)

    # The report analyses the learner's own words only. The character's lines
    # are context, never evidence about the learner.
    cues = []
    for cue in data.ego_state_cues:
        message = labels.get(cue.message_id)
        if message and message.role == "user" and _normalise(cue.evidence) in _normalise(message.content):
            cue.message_id = message.id
            cues.append(cue)
    data.ego_state_cues = cues

    transactions = []
    for item in data.transactions:
        ids = [labels[m].id for m in item.message_ids if m in labels]
        if ids:
            item.message_ids = ids
            transactions.append(item)
    data.transactions = transactions

    point = data.turning_point
    message = labels.get(point.message_id) if point else None
    if message and message.role == "user":
        point.message_id = message.id
    else:
        data.turning_point = None

    alternatives = []
    for alt in data.alternatives:
        message = labels.get(alt.message_id)
        if message and message.role == "user":
            alt.message_id = message.id
            alternatives.append(alt)
    data.alternatives = alternatives

    data.caveat = CAVEAT
    return data
