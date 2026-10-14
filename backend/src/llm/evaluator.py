"""TA evaluator and guided-mode coach: one structured response each."""

from langchain_core.messages import HumanMessage

from llm import formatting_util as fmt
from llm.model import build_agent
from llm.prompts.evaluation_report import EVALUATION_REPORT
from llm.prompts.ta_rules import TA_RULES
from llm.prompts.turn_coach import TURN_COACH
from models.evaluation import EvaluationReport
from models.thread import TurnFeedback


async def evaluate_thread(snapshot: dict, messages) -> EvaluationReport:
    transcript, labels = fmt.build_transcript(messages)
    agent = build_agent(
        EVALUATION_REPORT.format(
            ta_rules=TA_RULES,
            scenario=fmt.render_scenario(snapshot),
        ),
        response_format=EvaluationReport,
        temperature=0.2,
        max_tokens=4096,
        reasoning_effort="medium",
    )
    result = await agent.ainvoke(
        {"messages": [HumanMessage(f"<transcript>\n{transcript}\n</transcript>")]}
    )

    return fmt.ground_report(fmt.structured(result, EvaluationReport), labels)


async def review_turn(snapshot: dict, messages, draft: str) -> TurnFeedback:
    transcript, _ = fmt.build_transcript(messages)
    agent = build_agent(
        TURN_COACH.format(
            ta_rules=TA_RULES,
            scenario=fmt.render_scenario(snapshot),
        ),
        response_format=TurnFeedback,
        temperature=0.4,
        max_tokens=1024,
    )
    result = await agent.ainvoke(
        {
            "messages": [
                HumanMessage(
                    f"<transcript>\n{transcript}\n</transcript>\n"
                    f"<draft>\n{draft}\n</draft>"
                )
            ]
        }
    )

    return fmt.structured(result, TurnFeedback)
