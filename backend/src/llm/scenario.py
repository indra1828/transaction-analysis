"""Drafts a complete practice scenario from the learner's answers."""

from langchain_core.messages import HumanMessage

from llm import formatting_util as fmt
from llm.model import build_agent
from llm.prompts.scenario_design import SCENARIO_DESIGN
from models.scenario import ScenarioDraft, ScenarioDraftRequest


async def draft_scenario(data: ScenarioDraftRequest) -> ScenarioDraft:
    agent = build_agent(
        SCENARIO_DESIGN,
        response_format=ScenarioDraft,
        temperature=0.6,
        max_tokens=2048,
    )
    result = await agent.ainvoke(
        {"messages": [HumanMessage(fmt.scenario_brief(data))]}
    )

    return fmt.structured(result, ScenarioDraft)
