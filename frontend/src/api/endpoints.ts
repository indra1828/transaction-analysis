import { postStream, request } from "./client";
import type {
  Evaluation,
  Message,
  Mode,
  Scenario,
  ScenarioConfig,
  ScenarioDraft,
  ScenarioDraftInput,
  StreamHandlers,
  Thread,
  ThreadStart,
  Turn,
  User,
} from "./types";

// Auth. Sign-in starts with a full-page navigation to the backend.
export const GOOGLE_LOGIN_URL = "/api/v1/auth/google/login";

export const getMe = () => request<User>("GET", "/auth/me");
export const logout = () => request<{ message: string }>("POST", "/auth/logout");

// Scenarios
export const listScenarios = () => request<Scenario[]>("GET", "/scenarios");
export const getScenario = (id: string) => request<Scenario>("GET", `/scenarios/${id}`);
export const createScenario = (title: string, config: ScenarioConfig) =>
  request<Scenario>("POST", "/scenarios", { title, config });
export const draftScenario = (input: ScenarioDraftInput) =>
  request<ScenarioDraft>("POST", "/scenarios/draft", input);

// Threads (conversations)
export const listThreads = () => request<Thread[]>("GET", "/threads");
export const getThread = (id: string) => request<Thread>("GET", `/threads/${id}`);
export const startThread = (scenarioId: string, mode: Mode, maxTurns: number | null) =>
  request<ThreadStart>("POST", "/threads", {
    scenario_id: scenarioId,
    mode,
    max_turns: maxTurns,
  });
export const listMessages = (id: string) => request<Message[]>("GET", `/threads/${id}/messages`);
export const completeThread = (id: string) =>
  request<Evaluation>("POST", `/threads/${id}/complete`);
// Permanent: removes the conversation with its messages, edit history, turns and report.
export const deleteThread = (id: string) => request<void>("DELETE", `/threads/${id}`);
export const getEvaluation = (id: string) => request<Evaluation>("GET", `/threads/${id}/evaluation`);

// Simulation streams
export const streamEditMessage = (id: string, messageId: string, content: string, handlers: StreamHandlers) =>
  postStream(`/threads/${id}/messages/${messageId}`, { content }, handlers, "PATCH");
export const streamMessage = (id: string, content: string, handlers: StreamHandlers) =>
  postStream(`/threads/${id}/messages`, { content }, handlers);

// Guided practice
export const listTurns = (id: string) => request<Turn[]>("GET", `/threads/${id}/turns`);
export const createTurn = (id: string, content: string) =>
  request<Turn>("POST", `/threads/${id}/turns`, { content });
export const reviseTurn = (id: string, turnId: string, content: string) =>
  request<Turn>("POST", `/threads/${id}/turns/${turnId}/revise`, { content });
// Makes the coach's suggestion the draft. The server does not review it again.
export const adoptSuggestion = (id: string, turnId: string) =>
  request<Turn>("POST", `/threads/${id}/turns/${turnId}/use-suggestion`);
export const streamAcceptTurn =(id: string, turnId: string, handlers: StreamHandlers) =>
  postStream(`/threads/${id}/turns/${turnId}/accept`, undefined, handlers);
