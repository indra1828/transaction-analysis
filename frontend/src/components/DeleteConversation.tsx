import { useState } from "react";

import { deleteThread } from "../api";
import { ConfirmDialog } from "./ConfirmDialog";

interface DeleteConversationProps {
  threadId: string;
  onDeleted: () => void;
}

// A Delete button that asks before permanently removing the conversation.
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
        <ConfirmDialog
          title="Delete this conversation?"
          text="This permanently removes the conversation, its report and any branches made from it. This cannot be undone."
          confirmLabel="Yes, delete"
          pendingLabel="Deleting…"
          onConfirm={async () => {
            await deleteThread(threadId);
            onDeleted();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
