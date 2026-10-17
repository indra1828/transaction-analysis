import { pdf } from "@react-pdf/renderer";

import { ReportDocument } from "../components/ReportDocument";
import type { ReportPdfInput } from "../components/ReportDocument";

export type { ReportPdfInput };

// The report as a PDF file. Nothing is sent to a server.
export async function reportToPdf(input: ReportPdfInput): Promise<Blob> {
  return pdf(<ReportDocument {...input} />).toBlob();
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
