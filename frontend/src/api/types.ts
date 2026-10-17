// Mirrors the backend Pydantic models (src/models in the API project).

export interface User {
  id: string;
  email: string;
}

export interface ScenarioConfig {
  persona: string;
  user_role: string;
  context: string;
  objectives: string[];
  stopping_conditions: string[];
  opening_line: string;
}

export interface Scenario {
  id: string;
  title: string;
  config: Partial<ScenarioConfig>;
  is_public: boolean;
}

export interface ScenarioDraft {
  title: string;
  config: ScenarioConfig;
}

// The learner's answers. The backend drafts the rest of the scenario.
export interface ScenarioDraftInput {
  title: string;
  situation: string;
  user_role: string;
  ai_role: string;
  goals: string[];
  current?: ScenarioDraft; // the draft being revised
  feedback?: string; // what should change
}

// Only the fields being changed need to be sent.
export interface ScenarioUpdate {
  title?: string;
  config?: Partial<ScenarioConfig>;
}

export type Mode = "simulation" | "guided";

export interface Thread {
  id: string;
  user_id: string;
  scenario_id: string;
  mode: Mode;
  status: "active" | "completed";
  max_turns: number;
  parent_thread_id: string | null;
  branch_from_message_id: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  feedback: Record<string, unknown> | null;
  created_at: string;
}

export interface TurnFeedback {
  acceptable: boolean;
  feedback: string;
  ta_note: string;
  suggested_response: string;
}

export interface TurnRevision {
  content: string;
  feedback: TurnFeedback;
}

export interface Turn {
  id: string;
  thread_id: string;
  number: number;
  status: "draft" | "accepted";
  revisions: TurnRevision[];
  accepted_message_id: string | null;
}

export interface EgoStateCue {
  message_id: string;
  ego_state: "parent" | "adult" | "child";
  evidence: string;
  note: string;
}

export interface Transaction {
  message_ids: string[];
  kind: "complementary" | "crossed" | "possible_ulterior";
  explanation: string;
}

export interface ObjectiveResult {
  objective: string;
  status: "achieved" | "partly_achieved" | "missed";
  evidence: string;
}

export interface Alternative {
  message_id: string;
  suggested_response: string;
  why: string;
}

export interface EvaluationReport {
  summary: string;
  ego_state_cues: EgoStateCue[];
  transactions: Transaction[];
  assertiveness: string;
  active_listening: string;
  conflict_management: string;
  problem_solving: string;
  objectives: ObjectiveResult[];
  turning_point: { message_id: string; explanation: string } | null;
  strengths: string[];
  improvements: string[];
  alternatives: Alternative[];
  caveat: string;
}

export interface Evaluation {
  thread_id: string;
  report: EvaluationReport;
}


export interface ThreadStart extends Thread {
  opening_message: Message;
}

export type CompletionReason = "scenario_completed" | "max_turns" | null;

export interface StreamDone {
  message_id: string;
  thread_status: Thread["status"];
  completion_reason: CompletionReason;
}

export interface StreamHandlers {
  onDelta: (content: string) => void;
  onDone: (done: StreamDone) => void;
  onError: (detail: string) => void;
}
