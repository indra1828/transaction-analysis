import type { BadgeTone } from "../components/Badge";
import type { Mode, ObjectiveResult, Thread, Transaction } from "../api";

export const MODE_LABEL: Record<Mode, string> = {
  simulation: "Simulation",
  guided: "Guided practice",
};

export const STATUS_LABEL: Record<Thread["status"], string> = {
  active: "In progress",
  completed: "Completed",
};

export const OBJECTIVE_TONE: Record<ObjectiveResult["status"], BadgeTone> = {
  achieved: "success",
  partly_achieved: "warning",
  missed: "danger",
};

export const OBJECTIVE_LABEL: Record<ObjectiveResult["status"], string> = {
  achieved: "Achieved",
  partly_achieved: "Partly achieved",
  missed: "Missed",
};

export const TRANSACTION_LABEL: Record<Transaction["kind"], string> = {
  complementary: "Complementary",
  crossed: "Crossed",
  possible_ulterior: "Possible ulterior",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Comparison rows carry the status as a plain string, which may be absent.
export function isObjectiveStatus(value: string | null): value is ObjectiveResult["status"] {
  return value !== null && value in OBJECTIVE_LABEL;
}
