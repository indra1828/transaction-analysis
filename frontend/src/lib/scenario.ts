import type { ScenarioConfig, ScenarioDraft, ScenarioDraftInput } from "../api";

// The answers the person gives. The assistant writes everything else.
export interface ScenarioAnswers {
  title: string; // Name
  yourRole: string; // You are
  theirRole: string; // The character
  situation: string; // Scenario
  goals: string; // What you want to achieve, one point per line
}

export const EMPTY_ANSWERS: ScenarioAnswers = {
  title: "",
  yourRole: "",
  theirRole: "",
  situation: "",
  goals: "",
};

// The draft as text, so every part of it can be edited in the review step.
// Lists are one item per line.
export interface DraftText {
  title: string;
  persona: string;
  context: string;
  objectives: string;
  stoppingConditions: string;
  openingLine: string;
}

export function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function goalList(answers: ScenarioAnswers): string[] {
  return lines(answers.goals);
}

// Returns a message for the first missing answer, or null if the draft can be made.
export function validateAnswers(answers: ScenarioAnswers): string | null {
  if (!answers.title.trim()) return "Give the scenario a name.";
  if (!answers.yourRole.trim()) return "Tell us which role you are.";
  if (!answers.theirRole.trim()) return "Tell us which role the character plays.";
  if (!answers.situation.trim()) return "Describe the scenario.";
  if (goalList(answers).length === 0) return "Add at least one goal.";

  return null;
}

export function toDraftInput(
  answers: ScenarioAnswers,
  current?: DraftText,
  feedback?: string,
): ScenarioDraftInput {
  const input: ScenarioDraftInput = {
    title: answers.title.trim(),
    situation: answers.situation.trim(),
    user_role: answers.yourRole.trim(),
    ai_role: answers.theirRole.trim(),
    goals: goalList(answers),
  };

  if (current) {
    input.current = textToDraft(current, answers.yourRole.trim());
  }

  if (feedback?.trim()) {
    input.feedback = feedback.trim();
  }

  return input;
}

export function draftToText(draft: ScenarioDraft): DraftText {
  return {
    title: draft.title,
    persona: draft.config.persona,
    context: draft.config.context,
    objectives: draft.config.objectives.join("\n"),
    stoppingConditions: draft.config.stopping_conditions.join("\n"),
    openingLine: draft.config.opening_line,
  };
}

// Returns a message for the first problem in the reviewed draft, or null.
export function validateDraft(text: DraftText): string | null {
  if (!text.title.trim()) return "Give the scenario a name.";
  if (!text.persona.trim()) return "Describe the character.";
  if (!text.context.trim()) return "Describe the scenario.";
  if (!text.openingLine.trim()) return "Write the character's opening line.";
  if (lines(text.objectives).length === 0) return "Keep at least one goal.";
  if (lines(text.stoppingConditions).length === 0) return "Keep at least one 'ends when' condition.";

  return null;
}

// The scenario in the shape the backend stores.
export function textToDraft(text: DraftText, yourRole: string): ScenarioDraft {
  const config: ScenarioConfig = {
    persona: text.persona.trim(),
    user_role: yourRole,
    context: text.context.trim(),
    objectives: lines(text.objectives),
    stopping_conditions: lines(text.stoppingConditions),
    opening_line: text.openingLine.trim(),
  };

  return { title: text.title.trim(), config };
}
