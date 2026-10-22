import type { Scenario, ScenarioConfig, ScenarioDraft, ScenarioDraftInput, ScenarioUpdate } from "../api";

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

// A scenario as text, so every part of it can be edited. Lists are one item per line.
export interface DraftText {
  title: string;
  yourRole: string; // You are
  persona: string;
  context: string;
  objectives: string;
  stoppingConditions: string;
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
  if (!answers.theirRole.trim()) return "Tell us which role the AI character plays.";
  if (!answers.situation.trim()) return "Describe the scenario.";
  if (answers.situation.trim().length < 10) return "Describe the scenario in at least 10 characters.";
  if (goalList(answers).length === 0) return "Add at least one goal.";

  return null;
}

export function toDraftInput(answers: ScenarioAnswers, current?: DraftText, feedback?: string): ScenarioDraftInput {
  const input: ScenarioDraftInput = {
    title: answers.title.trim(),
    situation: answers.situation.trim(),
    user_role: answers.yourRole.trim(),
    ai_role: answers.theirRole.trim(),
    goals: goalList(answers),
  };

  if (current) {
    input.current = textToDraft(current);
  }

  if (feedback?.trim()) {
    input.feedback = feedback.trim();
  }

  return input;
}

export function draftToText(draft: ScenarioDraft): DraftText {
  return configToText(draft.title, draft.config);
}

// The text form of a saved scenario, for editing it. Missing parts start empty.
export function scenarioToText(scenario: Scenario): DraftText {
  return configToText(scenario.title, scenario.config);
}

function configToText(title: string, config: Partial<ScenarioConfig>): DraftText {
  return {
    title,
    yourRole: config.user_role ?? "",
    persona: config.persona ?? "",
    context: config.context ?? "",
    objectives: (config.objectives ?? []).join("\n"),
    stoppingConditions: (config.stopping_conditions ?? []).join("\n"),
  };
}

// Returns a message for the first problem in the reviewed draft, or null.
export function validateDraft(text: DraftText): string | null {
  if (!text.title.trim()) return "Give the scenario a name.";
  if (!text.yourRole.trim()) return "Tell us which role you are.";
  if (!text.persona.trim()) return "Describe the AI character.";
  if (!text.context.trim()) return "Describe the scenario.";
  if (lines(text.objectives).length === 0) return "Keep at least one goal.";
  if (lines(text.stoppingConditions).length === 0) return "Keep at least one 'ends when' condition.";

  return null;
}

// The scenario in the shape the backend stores.
export function textToDraft(text: DraftText): ScenarioDraft {
  return { title: text.title.trim(), config: textToConfig(text) };
}

// The changes to save when a scenario is edited. Every field is sent, so the
// saved scenario matches the form exactly.
export function textToUpdate(text: DraftText): ScenarioUpdate {
  return { title: text.title.trim(), config: textToConfig(text) };
}

function textToConfig(text: DraftText): ScenarioConfig {
  return {
    persona: text.persona.trim(),
    user_role: text.yourRole.trim(),
    context: text.context.trim(),
    objectives: lines(text.objectives),
    stopping_conditions: lines(text.stoppingConditions),
  };
}
