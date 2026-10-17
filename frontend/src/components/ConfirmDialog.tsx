import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { messageOf } from "../hooks/useAsync";
import { Alert } from "./Alert";

interface ConfirmDialogProps {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string; // shown on the confirm button while the action runs
  tone?: "danger" | "primary"; // danger for deleting; primary for everything else
  onConfirm: () => Promise<void>; // resolves when the action is done; rejects to show the error
  onCancel: () => void;
}

// A modal dialog that covers the page until it is answered. Escape and the
// backdrop cancel, and Cancel has focus so Enter does not confirm by accident.
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  cancelLabel = "Cancel",
  pendingLabel = "Please wait…",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onCancel();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [working, onCancel]);

  const confirm = async () => {
    setWorking(true);
    setError(null);

    try {
      await onConfirm();
    } catch (err) {
      setError(messageOf(err));
      setWorking(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/40 p-6" onMouseDown={() => !working && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-5 rounded-lg border border-hairline bg-canvas p-6 sm:p-8"
      >
        <div className="flex flex-col gap-2">
          <h2 id="confirm-title" className="text-2xl">
            {title}
          </h2>
          <p id="confirm-text" className="text-sm leading-relaxed text-body">
            {text}
          </p>
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            disabled={working}
            onClick={onCancel}
            className="cursor-pointer rounded-md border border-hairline px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-muted-soft hover:bg-card disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => void confirm()}
            className={`cursor-pointer rounded-md px-5 py-2.5 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${
              tone === "danger" ? "bg-error" : "bg-primary"
            }`}
          >
            {working ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
