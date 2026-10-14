import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { deleteThread } from "../api";
import { messageOf } from "../hooks/useAsync";
import { Alert } from "./Alert";

interface DeleteConfirmProps {
  threadId: string;
  onDeleted: () => void;
  onCancel: () => void;
}

// A modal dialog that covers the page. Only one conversation can be deleted at
// a time, so nothing else is reachable until it is answered. Escape and the
// backdrop cancel, and Cancel has focus so Enter does not delete by accident.
export function DeleteConfirm({ threadId, onDeleted, onCancel }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) onCancel();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleting, onCancel]);

  const confirm = async () => {
    setDeleting(true);
    setError(null);

    try {
      await deleteThread(threadId);
      onDeleted();
    } catch (err) {
      setError(messageOf(err));
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/40 p-6" onMouseDown={() => !deleting && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-text"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-5 rounded-lg border border-hairline bg-canvas p-6 sm:p-8"
      >
        <div className="flex flex-col gap-2">
          <h2 id="delete-title" className="text-2xl">
            Delete this conversation?
          </h2>
          <p id="delete-text" className="text-sm leading-relaxed text-body">
            This permanently removes the conversation, its report and any branches made from it. This cannot be
            undone.
          </p>
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="cursor-pointer rounded-md border border-hairline px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-muted-soft hover:bg-card disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void confirm()}
            className="cursor-pointer rounded-md bg-error px-5 py-2.5 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface DeleteConversationProps {
  threadId: string;
  onDeleted: () => void;
}

// A Delete button that opens the confirmation dialog.
export function DeleteConversation({ threadId, onDeleted }: DeleteConversationProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-error hover:underline"
      >
        Delete
      </button>
      {confirming && (
        <DeleteConfirm threadId={threadId} onDeleted={onDeleted} onCancel={() => setConfirming(false)} />
      )}
    </>
  );
}
