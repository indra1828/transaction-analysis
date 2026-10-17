import { jsPDF } from "jspdf";

import type { EvaluationReport } from "../api";
import { OBJECTIVE_LABEL, TRANSACTION_LABEL, formatDate } from "./format";

interface ReportFileInput {
  scenarioTitle: string;
  date: string; // ISO date the conversation started
  report: EvaluationReport;
  // Returns the learner's exact words for a message id, if still in the conversation.
  quoteOf: (messageId: string) => string | undefined;
}

// One piece of the report, in reading order. The PDF is drawn from these.
export type ReportBlock =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "body"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "small"; text: string };

// The report's content and order, with no layout.
export function reportBlocks({ scenarioTitle, date, report, quoteOf }: ReportFileInput): ReportBlock[] {
  const blocks: ReportBlock[] = [
    { kind: "title", text: scenarioTitle },
    { kind: "subtitle", text: `Report · ${formatDate(date)}` },
    { kind: "body", text: report.summary },
    { kind: "heading", text: "Goals" },
  ];

  for (const item of report.objectives) {
    blocks.push({ kind: "bullet", text: `${item.objective} (${OBJECTIVE_LABEL[item.status]}): ${item.evidence}` });
  }

  if (report.turning_point) {
    const quote = quoteOf(report.turning_point.message_id);
    blocks.push({ kind: "heading", text: "The turning point" });
    if (quote) blocks.push({ kind: "quote", text: `“${quote}”` });
    blocks.push({ kind: "body", text: report.turning_point.explanation });
  }

  if (report.ego_state_cues.length > 0) {
    blocks.push({ kind: "heading", text: "Ways of speaking" });
    for (const cue of report.ego_state_cues) {
      const state = cue.ego_state.charAt(0).toUpperCase() + cue.ego_state.slice(1);
      blocks.push({ kind: "bullet", text: `${state}: “${cue.evidence}”. ${cue.note}` });
    }
  }

  if (report.transactions.length > 0) {
    blocks.push({ kind: "heading", text: "How messages connected" });
    for (const item of report.transactions) {
      blocks.push({ kind: "bullet", text: `${TRANSACTION_LABEL[item.kind]}: ${item.explanation}` });
    }
  }

  blocks.push(
    { kind: "heading", text: "Four skills" },
    { kind: "bullet", text: `Assertiveness: ${report.assertiveness}` },
    { kind: "bullet", text: `Active listening: ${report.active_listening}` },
    { kind: "bullet", text: `Conflict management: ${report.conflict_management}` },
    { kind: "bullet", text: `Problem solving: ${report.problem_solving}` },
    { kind: "heading", text: "What went well" },
    ...report.strengths.map((text) => ({ kind: "bullet" as const, text })),
    { kind: "heading", text: "Work on next" },
    ...report.improvements.map((text) => ({ kind: "bullet" as const, text })),
  );

  if (report.alternatives.length > 0) {
    blocks.push({ kind: "heading", text: "Try instead" });
    for (const item of report.alternatives) {
      const quote = quoteOf(item.message_id);
      if (quote) blocks.push({ kind: "small", text: `You said: “${quote}”` });
      blocks.push({ kind: "bullet", text: `Try this: “${item.suggested_response}”` });
      blocks.push({ kind: "small", text: item.why });
    }
  }

  blocks.push({ kind: "small", text: report.caveat });

  return blocks;
}

// Page and text sizes in points (A4).
const PAGE = { width: 595.28, height: 841.89, margin: 56 };
const STYLE: Record<ReportBlock["kind"], { size: number; font: "normal" | "bold" | "italic"; gap: number; indent: number }> = {
  title: { size: 24, font: "bold", gap: 6, indent: 0 },
  subtitle: { size: 10, font: "normal", gap: 14, indent: 0 },
  heading: { size: 14, font: "bold", gap: 16, indent: 0 },
  body: { size: 11, font: "normal", gap: 8, indent: 0 },
  quote: { size: 12, font: "italic", gap: 8, indent: 12 },
  bullet: { size: 11, font: "normal", gap: 6, indent: 14 },
  small: { size: 9.5, font: "normal", gap: 4, indent: 0 },
};

// The report as a PDF, laid out on A4 pages. Nothing is sent to a server.
export function reportToPdf(input: ReportFileInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = PAGE.width - PAGE.margin * 2;
  const bottom = PAGE.height - PAGE.margin;
  let y = PAGE.margin;

  for (const block of reportBlocks(input)) {
    const style = STYLE[block.kind];
    const lineHeight = style.size * 1.4;
    const bullet = block.kind === "bullet";
    const x = PAGE.margin + style.indent;
    const lines = doc.setFont("helvetica", style.font).setFontSize(style.size).splitTextToSize(
      bullet ? `•  ${block.text}` : block.text,
      width - style.indent,
    ) as string[];

    y += style.gap;

    for (const line of lines) {
      if (y + lineHeight > bottom) {
        doc.addPage();
        y = PAGE.margin;
      }

      doc.text(line, x, y + style.size);
      y += lineHeight;
    }
  }

  return doc.output("blob");
}

// A file name that is safe on Windows, macOS and Linux.
export function reportFileName(scenarioTitle: string, date: string): string {
  const safeTitle = scenarioTitle.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "conversation";
  const day = new Date(date).toISOString().slice(0, 10);

  return `samvada-report-${safeTitle}-${day}.pdf`;
}

// Saves a file through the browser.
export function downloadFile(fileName: string, file: Blob): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
