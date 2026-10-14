from types import SimpleNamespace

from llm import formatting_util as fmt
from models.evaluation import EgoStateCue, EvaluationReport, TurningPoint


def report(cue_message, point_message):
    return EvaluationReport(
        summary="s",
        ego_state_cues=[
            EgoStateCue(message_id=cue_message, ego_state="adult", evidence="I can send the draft", note="n"),
        ],
        transactions=[],
        assertiveness="a",
        active_listening="a",
        conflict_management="c",
        problem_solving="p",
        objectives=[],
        turning_point=TurningPoint(message_id=point_message, explanation="e"),
        strengths=[],
        improvements=[],
        alternatives=[],
        caveat="x",
    )


def labelled():
    learner = SimpleNamespace(id="u1", role="user", content="I can send the draft by noon")
    character = SimpleNamespace(id="a1", role="assistant", content="I can send the draft too, if you like")
    return {"m1": character, "m2": learner}


def test_cues_and_turning_point_must_come_from_the_learner():
    labels = labelled()

    grounded = fmt.ground_report(report("m1", "m1"), labels)
    assert grounded.ego_state_cues == []
    assert grounded.turning_point is None


def test_learner_evidence_is_kept_and_linked_to_its_id():
    labels = labelled()

    grounded = fmt.ground_report(report("m2", "m2"), labels)
    assert [cue.message_id for cue in grounded.ego_state_cues] == ["u1"]
    assert grounded.turning_point.message_id == "u1"
