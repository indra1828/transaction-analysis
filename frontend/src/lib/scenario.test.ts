import { describe, expect, it } from "vitest";

import {
  EMPTY_ANSWERS,
  draftToText,
  goalList,
  textToDraft,
  toDraftInput,
  validateAnswers,
  validateDraft,
} from "./scenario";
import type { DraftText, ScenarioAnswers } from "./scenario";

const answers: ScenarioAnswers = {
  title: "  Missed Deadline  ",
  yourRole: " Team manager ",
  theirRole: "Analyst who missed the deadline",
  situation: "The report went out a day late.",
  goals: "Understand why it was late\n\n   \nAgree a plan",
};

const reviewed: DraftText = {
  title: "Missed Deadline",
  persona: "Arjun, an analyst who is apologetic and anxious.",
  context: "The report went out a day late.",
  objectives: "Understand why it was late\nAgree a plan",
  stoppingConditions: "A plan is agreed",
  openingLine: "I know why you wanted to see me.",
};

describe("validateAnswers", () => {
  it("asks for the name first", () => {
    expect(validateAnswers(EMPTY_ANSWERS)).toBe("Give the scenario a name.");
  });

  it("names the missing role", () => {
    expect(validateAnswers({ ...answers, yourRole: "" })).toBe("Tell us which role you are.");
    expect(validateAnswers({ ...answers, theirRole: "" })).toBe("Tell us which role the character plays.");
  });

  it("accepts complete answers", () => {
    expect(validateAnswers(answers)).toBeNull();
  });

  it("treats blank goal lines as missing", () => {
    expect(validateAnswers({ ...answers, goals: "\n   \n" })).toBe("Add at least one goal.");
  });
});

describe("goalList", () => {
  it("returns one trimmed goal per non-empty line", () => {
    expect(goalList(answers)).toEqual(["Understand why it was late", "Agree a plan"]);
  });
});

describe("toDraftInput", () => {
  it("sends the answers as points, trimmed", () => {
    const input = toDraftInput(answers);

    expect(input).toEqual({
      title: "Missed Deadline",
      situation: "The report went out a day late.",
      user_role: "Team manager",
      ai_role: "Analyst who missed the deadline",
      goals: ["Understand why it was late", "Agree a plan"],
    });
  });

  it("adds the draft and feedback only when revising", () => {
    const input = toDraftInput(answers, reviewed, "  make the character more defensive ");

    expect(input.feedback).toBe("make the character more defensive");
    expect(input.current?.config.opening_line).toBe("I know why you wanted to see me.");
    expect(input.current?.config.user_role).toBe("Team manager");
  });
});

describe("draft review", () => {
  it("round-trips a draft through the editable text form", () => {
    const draft = textToDraft(reviewed, "Team manager");

    expect(draftToText(draft)).toEqual(reviewed);
    expect(draft.config.stopping_conditions).toEqual(["A plan is agreed"]);
  });

  it("requires an opening line and an ends-when condition", () => {
    expect(validateDraft({ ...reviewed, openingLine: " " })).toBe("Write the character's opening line.");
    expect(validateDraft({ ...reviewed, stoppingConditions: "" })).toBe(
      "Keep at least one 'ends when' condition.",
    );
  });

  it("accepts a complete reviewed draft", () => {
    expect(validateDraft(reviewed)).toBeNull();
  });
});
