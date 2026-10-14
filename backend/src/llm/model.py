"""Model and agent setup shared by every LLM workflow."""

import os
from typing import get_args

from deepagents import (
    FsToolName,
    HarnessProfile,
    create_deep_agent,
    register_harness_profile,
)
from deepagents.profiles import GeneralPurposeSubagentProfile
from langchain_groq import ChatGroq

# Groq's featured production model. It supports JSON schema (strict)
# structured output, but not streaming or tool calling together with it.
# Override with LLM_MODEL; the API key is read from GROQ_API_KEY.
DEFAULT_MODEL = "openai/gpt-oss-120b"

# Deep Agents adds file tools and a subagent tool to every agent. Our
# workflows make a single model call and need neither, so hide them from
# the model. The profile applies to every Groq model in this process.
register_harness_profile(
    "groq",
    HarnessProfile(
        excluded_tools=frozenset({*get_args(FsToolName), "task"}),
        general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False),
    ),
)


def get_llm(**kwargs) -> ChatGroq:
    model = os.getenv("LLM_MODEL", DEFAULT_MODEL)

    if model.startswith("openai/gpt-oss"):
        kwargs.setdefault("reasoning_effort", "low")

    return ChatGroq(model=model, max_retries=2, timeout=60, **kwargs)


def build_agent(system_prompt: str, response_format=None, **model_kwargs):
    """Agent that makes one model call and no tool calls.

    Pass a Pydantic model as `response_format` to get a validated
    `structured_response` in the result.
    """
    return create_deep_agent(
        model=get_llm(**model_kwargs),
        system_prompt=system_prompt,
        response_format=response_format,
    )
