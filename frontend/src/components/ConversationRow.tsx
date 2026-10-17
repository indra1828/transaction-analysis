import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { deleteThread } from "../api";
import type { Thread } from "../api";
import { MODE_LABEL, STATUS_LABEL, formatDate } from "../lib/format";
import { Badge } from "./Badge";
import { ConfirmDialog } from "./ConfirmDialog";
import { RowMenu } from "./RowMenu";

interface ConversationRowProps {
  thread: Thread;
  title: string | undefined;
  onDeleted: () => void;
}

// One conversation in the dashboard list. Its actions sit behind the
// three-dot menu at the end of the row.
export function ConversationRow({ thread, title, onDeleted }: ConversationRowProps) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const menuItems = [
    ...(thread.status === "completed"
      ? [{ label: "View report", onSelect: () => navigate(`/threads/${thread.id}/report`) }]
      : []),
    { label: "Delete", danger: true, onSelect: () => setConfirming(true) },
  ];

  return (
    <li className="flex flex-col gap-4 bg-canvas p-5 transition-colors hover:bg-card">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Link to={`/threads/${thread.id}`} className="truncate text-base font-medium text-ink hover:underline">
            {title ?? "Conversation"}
          </Link>
          <span className="text-sm text-muted">{formatDate(thread.created_at)}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden flex-wrap items-center gap-3 sm:flex">
            <Badge>{MODE_LABEL[thread.mode]}</Badge>
            <Badge tone={thread.status === "completed" ? "success" : "neutral"}>
              {STATUS_LABEL[thread.status]}
            </Badge>
          </div>
          <RowMenu label={`More options for ${title ?? "this conversation"}`} items={menuItems} />
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete this conversation?"
          text="This permanently removes the conversation, its report and any branches made from it. This cannot be undone."
          confirmLabel="Yes, delete"
          pendingLabel="Deleting…"
          onConfirm={async () => {
            await deleteThread(thread.id);
            onDeleted();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
