// Live end-to-end tests: the real App drives a real backend and the real
// LLM. They are skipped unless both variables are set:
//
//   E2E_BASE    backend origin, for example http://127.0.0.1:8001
//   E2E_COOKIE  a signed ta_coach_session cookie value for a test user
//
// Run with: npm run test:e2e
/// <reference types="node" />
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "../App";

const BASE = process.env.E2E_BASE;
const COOKIE = process.env.E2E_COOKIE;
const suite = BASE && COOKIE ? describe : describe.skip;

const LONG = 240_000; // real model calls can take a while
const SLOW = { timeout: 120_000 };

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  render(<App />);
}

function countCharacterBubbles(): number {
  return screen.queryAllByText("AI Chatbot").length;
}

async function waitForCharacterReplies(count: number) {
  await waitFor(() => expect(countCharacterBubbles()).toBeGreaterThanOrEqual(count), SLOW);
}

// The reply box is disabled while a reply streams. Wait for it to be enabled
// again, so the page is idle before the next step.
async function waitUntilIdle() {
  await waitFor(() => {
    const box = screen.getByLabelText(/Your reply|Draft reply/) as HTMLTextAreaElement;
    expect(box.disabled).toBe(false);
  }, SLOW);
}

// Opens a scenario from the dashboard. The card is found through its heading,
// because earlier conversations can share the same title as a link.
async function openBuiltInScenario(title: string) {
  renderAt("/");
  const heading = await screen.findByRole("heading", { name: title }, SLOW);
  fireEvent.click(heading.closest("a") as HTMLElement);
  await screen.findByRole("heading", { name: title }, SLOW);
}

// Starts a conversation from the scenario page and waits for the thread page.
// The scenario page also shows the opening line, so wait for the reply box.
async function startConversation() {
  fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));
  return screen.findByLabelText(/Your reply|Draft reply/, {}, SLOW);
}

suite("live end-to-end", () => {
  const realFetch = globalThis.fetch;

  beforeAll(() => {
    // jsdom does not implement scrollIntoView, which the transcript uses.
    Element.prototype.scrollIntoView = () => undefined;

    // Relative /api paths go to the live backend, with the test session cookie.
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" && input.startsWith("/") ? `${BASE}${input}` : input;
      const headers = new Headers(init?.headers);
      headers.set("Cookie", `ta_coach_session=${COOKIE}`);
      return realFetch(url, { ...init, headers });
    }) as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
  });

  afterEach(() => {
    cleanup();
  });

  it("signs in and shows the dashboard with built-in scenarios", async () => {
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Missed Deadline" }, SLOW)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Defensive Employee" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Silent Team" })).toBeTruthy();
    expect(screen.getByText("Your conversations")).toBeTruthy();
    // The email lives in the account menu, not the header.
    fireEvent.click(screen.getByRole("button", { name: /Account menu for/ }));
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
    expect(screen.getByText(/@example\.com/)).toBeTruthy();
  }, LONG);

  it("runs a simulation from start to TA report", async () => {
    await openBuiltInScenario("Missed Deadline");
    await startConversation();

    await screen.findByText(/I know why you wanted to see me/, {}, SLOW);
    expect(countCharacterBubbles()).toBe(1);

    const reply = "I want to understand what happened, without blame.";
    fireEvent.change(screen.getByLabelText("Your reply"), { target: { value: reply } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText(reply, {}, SLOW);
    await waitForCharacterReplies(2);
    await waitUntilIdle();
    expect(screen.getByText(/1 of 10 turns/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(await screen.findByRole("heading", { name: "Goals" }, SLOW)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Goals" })).toBeTruthy();
    expect(screen.getAllByText(/tentative/i).length).toBeGreaterThan(0);
  }, LONG);

  it("runs guided practice in the same chat: draft, feedback, send, character replies", async () => {
    await openBuiltInScenario("Missed Deadline");
    fireEvent.click(screen.getByLabelText(/Guided practice/));
    await startConversation();

    // The draft is typed into the same reply bar as simulation; Send asks for feedback.
    const draft = "You never give us enough time to deliver.";
    fireEvent.change(screen.getByLabelText("Your reply"), { target: { value: draft } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/Ready to send|Could be stronger/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send to AI character" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Send to AI character" }));

    await waitForCharacterReplies(2);
    await waitUntilIdle();
    expect(screen.getByText(/1 of 10 turns/)).toBeTruthy();
  }, LONG);

  it("edits a message in place and keeps the same conversation", async () => {
    await openBuiltInScenario("Silent Team");
    await startConversation();
    const conversationPath = window.location.pathname;

    const first = "I want to understand why nobody raises concerns in our meetings.";
    fireEvent.change(screen.getByLabelText("Your reply"), { target: { value: first } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText(first, {}, SLOW);
    await waitForCharacterReplies(2);
    await waitUntilIdle();

    // Edit the message with the pencil. The text appears once, inside the editor.
    fireEvent.click(screen.getByRole("button", { name: "Edit this message and send a different reply" }));
    const edited = "What would make it safe to challenge an idea in our meetings?";
    const editor = screen.getByLabelText("Edit your message") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: edited } });
    fireEvent.click(screen.getByRole("button", { name: "Send edited message" }));

    await screen.findByText(edited, {}, SLOW);
    await waitForCharacterReplies(2);
    await waitUntilIdle();

    // Same conversation: no new conversation was created.
    expect(window.location.pathname).toBe(conversationPath);
    expect(screen.queryByText(/different reply to an earlier conversation/)).toBeNull();
    expect(screen.queryByText(first)).toBeNull();
  }, LONG);

  it("creates a custom scenario and shows validation first", async () => {
    renderAt("/scenarios/new");
    await screen.findByRole("heading", { name: "New Scenario" }, SLOW);

    fireEvent.click(screen.getByRole("button", { name: "Create scenario" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/name/i);

    const unique = `Vendor escalation ${Date.now()}`;
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: unique } });
    fireEvent.change(screen.getByLabelText("You are"), { target: { value: "Procurement lead" } });
    fireEvent.change(screen.getByLabelText("AI Character"), {
      target: { value: "Vendor account lead who is polite but defensive" },
    });
    fireEvent.change(screen.getByLabelText("Scenario"), {
      target: { value: "The vendor missed two delivery dates this quarter." },
    });
    fireEvent.change(screen.getByLabelText("What you want to achieve"), {
      target: { value: "Agree a recovery date" },
    });

    // The assistant drafts the opening line and the ending; review, then save.
    fireEvent.click(screen.getByRole("button", { name: "Create scenario" }));
    expect(await screen.findByRole("heading", { name: "Review the scenario" }, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save scenario" }));

    expect(await screen.findByRole("heading", { name: unique }, SLOW)).toBeTruthy();
    expect(screen.getByText("Yours")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start conversation" })).toBeTruthy();
  }, LONG);

  it("deletes a conversation after confirmation and returns to the list", async () => {
    await openBuiltInScenario("Defensive Employee");
    await startConversation();
    const conversationId = window.location.pathname.split("/")[2];

    // Deleting happens from the dashboard row menu, not the conversation page.
    renderAt("/");
    const [newest] = await screen.findAllByRole("button", { name: /More options for/ }, SLOW);
    fireEvent.click(newest);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(await screen.findByRole("heading", { name: "Your conversations" }, SLOW)).toBeTruthy();
    expect(window.location.pathname).toBe("/");

    // The deleted conversation no longer exists on the server.
    const response = await fetch(`/api/v1/threads/${conversationId}`);
    expect(response.status).toBe(404);
  }, LONG);

  it("shows clear messages for unknown routes and scenarios", async () => {
    renderAt("/does-not-exist");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();

    cleanup();
    renderAt("/scenarios/00000000-0000-0000-0000-000000000000");
    expect(await screen.findByRole("alert", {}, SLOW)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/not found/i);
  }, LONG);
});
