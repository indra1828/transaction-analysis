"""Checks that run before any model call.

The model is not the only line of defence. Requests for secrets, system
internals or changes to the rules are answered here, with a fixed reply,
so they never reach a prompt.
"""

import re

# Secrets, configuration, the system prompt and attempts to override the rules.
_BLOCKED = re.compile(
    r"api[\s_-]?keys?"
    r"|client[\s_-]?secret"
    r"|secret[\s_-]?keys?"
    r"|access[\s_-]?tokens?"
    r"|passwords?"
    r"|\.env\b"
    r"|environment variables?"
    r"|system prompt"
    r"|your (instructions|prompt|rules|configuration)"
    r"|ignore (all |the |your )?(previous|prior|above|earlier) (instructions|messages|rules)"
    r"|developer mode"
    r"|jailbreak"
    r"|(reveal|show|print|dump) .{0,40}(prompt|instructions|keys?|secrets?|tokens?)",
    re.IGNORECASE,
)


def is_blocked(text: str) -> bool:
    return bool(_BLOCKED.search(text))
