import { describe, expect, it } from "vitest";

import type { EvaluationReport } from "../api";
import { reportBlocks, reportFileName, reportToPdf } from "./reportFile";

const report: EvaluationReport = {
  summary: "You stated the problem clearly.",
  ego_state_cues: [{ message_id: "m1", ego_state: "adult", evidence: "Let us agree a date", note: "Calm and factual." }],
  transactions: [{ message_ids: ["m1"], kind: "complementary", explanation: "The reply matched the question." }],
  assertiveness: "Clear requests.",
  active_listening: "Summarised the reply.",
  conflict_management: "Stayed on the facts.",
  problem_solving: "Proposed a date.",
  objectives: [{ objective: "Agree a new date", status: "achieved", evidence: "Friday was agreed." }],
  turning_point: { message_id: "m1", explanation: "This message changed the direction." },
  strengths: ["Kept calm"],
  improvements: ["Ask what caused the delay"],
  alternatives: [{ message_id: "m2", suggested_response: "What got in the way?", why: "Opens the discussion." }],
  caveat: "These are tentative observations.",
};

const quoteOf = (id: string) => (id === "m1" ? "Let us agree a date" : id === "m2" ? "Just get it done" : undefined);

const input = { scenarioTitle: "Missed deadline", date: "2026-10-14T10:00:00Z", report, quoteOf };

describe("reportBlocks", () => {
  it("includes every section with the learner's own words", () => {
    const text = reportBlocks(input).map((block) => block.text);

    expect(text).toContain("Missed deadline");
    expect(text).toContain("Goals");
    expect(text).toContain("Agree a new date (Achieved): Friday was agreed.");
    expect(text).toContain("“Let us agree a date”");
    expect(text).toContain("Ways of speaking");
    expect(text).toContain("How messages connected");
    expect(text).toContain("Assertiveness: Clear requests.");
    expect(text).toContain("You said: “Just get it done”");
    expect(text).toContain("Try this: “What got in the way?”");
    expect(text).toContain("These are tentative observations.");
  });

  it("leaves out sections that are empty", () => {
    const blocks = reportBlocks({
      ...input,
      report: { ...report, turning_point: null, ego_state_cues: [], transactions: [], alternatives: [] },
      quoteOf: () => undefined,
    });
    const headings = blocks.filter((block) => block.kind === "heading").map((block) => block.text);

    expect(headings).not.toContain("The turning point");
    expect(headings).not.toContain("Ways of speaking");
    expect(headings).not.toContain("How messages connected");
    expect(headings).not.toContain("Try instead");
  });
});

describe("reportToPdf", () => {
  it("produces a PDF file", async () => {
    const pdf = reportToPdf(input);
    const header = new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()).slice(0, 5));

    expect(pdf.type).toBe("application/pdf");
    expect(header).toBe("%PDF-");
  });

  it("starts a new page when the report is long", async () => {
    const long = {
      ...input,
      report: { ...report, strengths: Array.from({ length: 80 }, (_, i) => `Strength number ${i} with a longer sentence to wrap.`) },
    };
    const pdf = reportToPdf(long);
    const text = new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer()));

    const pages = Number(/\/Type \/Pages[\s\S]*?\/Count (\d+)/.exec(text)?.[1]);

    expect(pages).toBeGreaterThan(1);
  });
});

describe("reportFileName", () => {
  it("makes a safe, dated PDF file name", () => {
    expect(reportFileName("Missed deadline: Friday / late?", "2026-10-14T10:00:00Z")).toBe(
      "samvada-report-Missed-deadline-Friday-late-2026-10-14.pdf",
    );
  });

  it("falls back when the title has no usable characters", () => {
    expect(reportFileName("???", "2026-10-14T10:00:00Z")).toBe("samvada-report-conversation-2026-10-14.pdf");
  });
});
