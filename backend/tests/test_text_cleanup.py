from llm import formatting_util as fmt
from models.scenario import ScenarioConfig, ScenarioDraft


def test_em_and_en_dashes_become_commas():
    assert fmt.plain_punctuation("The report — the one due Friday — was late.") == (
        "The report, the one due Friday, was late."
    )
    assert fmt.plain_punctuation("Q1–Q2 targets") == "Q1, Q2 targets"


def test_plain_hyphens_are_kept():
    assert fmt.plain_punctuation("A well-known e-mail") == "A well-known e-mail"


def test_structured_responses_are_cleaned_before_validation():
    result = {
        "structured_response": ScenarioDraft(
            title="Missed deadline — Friday",
            config=ScenarioConfig(
                persona="Arjun — an analyst",
                user_role="Manager",
                context="Late report — again",
                objectives=["Explain the delay — honestly"],
                stopping_conditions=["A plan is agreed"],
            ),
        )
    }

    draft = fmt.structured(result, ScenarioDraft)

    assert draft.title == "Missed deadline, Friday"
    assert draft.config.persona == "Arjun, an analyst"
    assert draft.config.objectives == ["Explain the delay, honestly"]
    assert "—" not in draft.model_dump_json()
