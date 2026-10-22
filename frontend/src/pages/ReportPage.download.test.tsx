import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getEvaluation, getScenario, getThread, listMessages } from "../api";
import { ReportPage } from "./ReportPage";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();

  return {
    ...actual,
    getThread: vi.fn(),
    getScenario: vi.fn(),
    listMessages: vi.fn(),
    getEvaluation: vi.fn(),
    completeThread: vi.fn(),
  };
});

const report = {
  summary: "You stated the problem clearly.",
  ego_state_cues: [],
  transactions: [],
  assertiveness: "Clear requests.",
  active_listening: "Summarised the reply.",
  conflict_management: "Stayed on the facts.",
  problem_solving: "Proposed a date.",
  objectives: [{ objective: "Agree a new date", status: "achieved" as const, evidence: "Friday was agreed." }],
  turning_point: null,
  strengths: ["Kept calm"],
  improvements: ["Ask what caused the delay"],
  alternatives: [],
  caveat: "These are tentative observations.",
};

beforeEach(() => {
  vi.mocked(getThread).mockResolvedValue({
    id: "t1",
    scenario_id: "s1",
    mode: "simulation",
    status: "completed",
    max_turns: 20,
    created_at: "2026-10-14T10:00:00Z",
  } as never);
  vi.mocked(getScenario).mockResolvedValue({ id: "s1", title: "Missed deadline", config: {}, is_public: true, is_shared: false, editable: false });
  vi.mocked(listMessages).mockResolvedValue([]);
  vi.mocked(getEvaluation).mockResolvedValue({ thread_id: "t1", report } as never);

  // The browser's download link is not available in jsdom, so it is stubbed here.
  URL.createObjectURL = vi.fn(() => "blob:report");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Download report button", () => {
  it("builds the PDF and starts a download named after the report", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={["/threads/t1/report"]}>
        <Routes>
          <Route path="/threads/:id/report" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Download report" }));

    // Building the PDF can take a few seconds when the whole suite runs in parallel.
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1), { timeout: 15000 });
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^samvada-report-Missed-deadline-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
