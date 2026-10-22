import { postStream, request } from "./client";
import type {
  AdminUser,
  ConversationDetail,
  Evaluation,
  Message,
  Mode,
  Role,
  Scenario,
  ScenarioConfig,
  ScenarioUpdate,
  ScenarioDraft,
  ScenarioDraftInput,
  StreamHandlers,
  SubmissionPage,
  TeacherScenario,
  Thread,
  Turn,
  User,
} from "./types";

// One page of a list. Lists are paginated, so each call asks for a window.
export interface Page {
  offset: number;
  limit: number;
}

const pageQuery = (page: Page) => `offset=${page.offset}&limit=${page.limit}`;

// Auth. Sign-in starts with a full-page navigation to the backend.
export const GOOGLE_LOGIN_URL = "/api/v1/auth/google/login";

export const getMe = () => request<User>("GET", "/auth/me");
export const logout = () => request<{ message: string }>("POST", "/auth/logout");

// Scenarios
export const listScenarios = (page: Page) => request<Scenario[]>("GET", `/scenarios?${pageQuery(page)}`);
export const getScenario = (id: string) => request<Scenario>("GET", `/scenarios/${id}`);
export const createScenario = (title: string, config: ScenarioConfig, isShared: boolean) =>
  request<Scenario>("POST", "/scenarios", { title, config, is_shared: isShared });
export const draftScenario = (input: ScenarioDraftInput) =>
  request<ScenarioDraft>("POST", "/scenarios/draft", input);
// Only for scenarios the user created. Built-in scenarios are refused.
export const updateScenario = (id: string, changes: ScenarioUpdate) =>
  request<Scenario>("PATCH", `/scenarios/${id}`, changes);
export const deleteScenario = (id: string) => request<void>("DELETE", `/scenarios/${id}`);

// Threads (conversations)
export const listThreads = (page: Page) => request<Thread[]>("GET", `/threads?${pageQuery(page)}`);
export const getThread = (id: string) => request<Thread>("GET", `/threads/${id}`);
export const startThread = (scenarioId: string, mode: Mode, maxTurns: number | null) =>
  request<Thread>("POST", "/threads", {
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
export const streamAcceptTurn = (id: string, turnId: string, handlers: StreamHandlers) =>
  postStream(`/threads/${id}/turns/${turnId}/accept`, undefined, handlers);

// Teacher dashboard: scenario cards, each with its submitted conversations.
export interface SubmissionFilters extends Page {
  q?: string;
  sort: "newest" | "oldest";
}

export const listTeacherScenarios = (page: Page) =>
  request<TeacherScenario[]>("GET", `/teacher/scenarios?${pageQuery(page)}`);

export const listScenarioSubmissions = (scenarioId: string, filters: SubmissionFilters) => {
  const search = filters.q?.trim() ? `&q=${encodeURIComponent(filters.q.trim())}` : "";
  return request<SubmissionPage>(
    "GET",
    `/teacher/scenarios/${scenarioId}/conversations?${pageQuery(filters)}&sort=${filters.sort}${search}`,
  );
};

export const getTeacherConversation = (id: string) =>
  request<ConversationDetail>("GET", `/teacher/conversations/${id}`);

// Superadmin only.
export const listUsers = (page: Page) => request<AdminUser[]>("GET", `/admin/users?${pageQuery(page)}`);
export const setUserRole = (userId: string, role: Role) =>
  request<AdminUser>("PATCH", `/admin/users/${userId}/role`, { role });
