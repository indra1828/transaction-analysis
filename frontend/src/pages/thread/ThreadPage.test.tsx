import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeThread, getScenario, getThread, listMessages, streamMessage } from "../../api";
import { ThreadPage } from "./ThreadPage";

vi.mock("../../api", () => ({
  completeThread: vi.fn(),
  createTurn: vi.fn(),
  getScenario: vi.fn(),
  getThread: vi.fn(),
  listMessages: vi.fn(),
  listTurns: vi.fn(),
  reviseTurn: vi.fn(),
  streamAcceptTurn: vi.fn(),
  streamEditMessage: vi.fn(),
  streamMessage: vi.fn(),
}));

const thread = {
  id: "t1",
  scenario_id: "s1",
  mode: "simulation",
  status: "active",
  max_turns: 20,
  created_at: "2026-10-14T10:00:00Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/threads/t1"]}>
      <Routes>
        <Route path="/threads/:id" element={<ThreadPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Sends one reply; the character signals that a closing condition is met.
async function sendReplyThatReachesAnEnding() {
  fireEvent.change(screen.getByLabelText("Your reply"), { target: { value: "Let's agree a new date." } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => {
  vi.mocked(getThread).mockResolvedValue(thread as never);
  vi.mocked(listMessages).mockResolvedValue([]);
  vi.mocked(getScenario).mockResolvedValue({ id: "s1", title: "Missed deadline", config: {}, is_public: true, is_shared: false, editable: false });
  vi.mocked(streamMessage).mockImplementation(async (_id, _text, handlers) => {
    handlers.onDelta("Thanks, that helps.");
    handlers.onDone({ message_id: "m1", thread_status: "active", completion_reason: "scenario_completed" });
  });
  vi.mocked(completeThread).mockResolvedValue({} as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ThreadPage ending", () => {
  it("asks whether to finish when a closing condition is met, and keeps the conversation open", async () => {
    renderPage();
    await screen.findByLabelText("Your reply");

    await sendReplyThatReachesAnEnding();

    const dialog = await screen.findByRole("dialog", { name: "The scenario has reached its ending" });
    expect(dialog).toBeTruthy();
    expect(screen.queryByText("This conversation is complete.")).toBeNull();
    expect(completeThread).not.toHaveBeenCalled();
  });

  it("closes the question and keeps talking when the learner chooses to continue", async () => {
    renderPage();
    await screen.findByLabelText("Your reply");
    await sendReplyThatReachesAnEnding();
    await screen.findByRole("dialog", { name: "The scenario has reached its ending" });

    fireEvent.click(screen.getByRole("button", { name: "Keep talking" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Your reply")).toBeTruthy();
    expect(completeThread).not.toHaveBeenCalled();
  });

  it("finishes the conversation and opens the report when the learner chooses to finish", async () => {
    renderPage();
    await screen.findByLabelText("Your reply");
    await sendReplyThatReachesAnEnding();
    await screen.findByRole("dialog", { name: "The scenario has reached its ending" });

    fireEvent.click(screen.getByRole("button", { name: "Finish and get report" }));

    await waitFor(() => expect(completeThread).toHaveBeenCalledWith("t1"));
  });
});
