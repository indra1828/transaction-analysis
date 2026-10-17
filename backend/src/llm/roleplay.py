"""Roleplay agent: plays the scenario character and never coaches."""

from langchain_core.messages import HumanMessage

from llm import formatting_util as fmt
from llm import guardrails
from llm.model import build_agent
from llm.prompts.roleplay_character import ROLEPLAY_CHARACTER
from llm.prompts.roleplay_opening import ROLEPLAY_OPENING

END = object()  # yielded by stream_reply when the scenario has concluded
# The character may not signal an ending before the learner has had this many
# messages, so the conversation has room to develop. An earlier marker is removed.
MIN_LEARNER_MESSAGES_BEFORE_END = 8


def _agent(snapshot: dict):
    return build_agent(
        ROLEPLAY_CHARACTER.format(
            scenario=fmt.render_scenario(snapshot),
            end_marker=fmt.END_MARKER,
            refusal=fmt.REFUSAL,
        ),
        temperature=0.8,
        max_tokens=1024,
    )


async def opening_message(snapshot: dict) -> str:
    opening_line = snapshot.get("config", {}).get("opening_line")

    if opening_line:
        return opening_line

    result = await _agent(snapshot).ainvoke(
        {"messages": [HumanMessage(ROLEPLAY_OPENING)]}
    )
    text = fmt.strip_end_marker(fmt.last_text(result))

    if not text:
        raise RuntimeError("AI returned an empty opening message")

    return text


async def stream_reply(snapshot: dict, history):
    """Yield reply tokens; yield END last if the scenario has concluded."""
    latest = history[-1] if history else None

    # Requests for secrets or rule changes get the fixed reply, with no model call.
    if latest is not None and latest.role == "user" and guardrails.is_blocked(latest.content):
        yield fmt.REFUSAL
        return

    learner_messages = sum(1 for item in history if item.role == "user")
    may_end = learner_messages >= MIN_LEARNER_MESSAGES_BEFORE_END
    stream = _agent(snapshot).astream(
        {"messages": fmt.to_chat_messages(history)},
        stream_mode="messages",
    )
    pending = ""

    async for message, metadata in stream:
        if metadata.get("langgraph_node") != "model":
            continue

        text = fmt.plain_punctuation(fmt.text_of(message))
        if not text:
            continue

        pending += text

        if not may_end:
            pending = pending.replace(fmt.END_MARKER, "")

        if fmt.END_MARKER in pending:
            before = pending.split(fmt.END_MARKER)[0]
            if before:
                yield before
            yield END
            return

        safe, pending = fmt.hold_back_partial_marker(pending)
        if safe:
            yield safe

    if pending:
        yield pending
