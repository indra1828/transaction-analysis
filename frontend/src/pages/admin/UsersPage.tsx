import { useState } from "react";

import { Alert } from "../../components/Alert";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ArrowDownIcon, ArrowUpIcon } from "../../components/icons";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { listUsers, setUserRole } from "../../api";
import type { AdminUser, Role } from "../../api";
import { usePagedList } from "../../hooks/usePagedList";

interface PendingChange {
  user: AdminUser;
  role: "student" | "teacher";
}

// Superadmins only. Promote a student to teacher, or remove the teacher role. Every change is confirmed first.
export function UsersPage() {
  const users = usePagedList((offset, limit) => listUsers({ offset, limit }), "admin-users");
  const [pending, setPending] = useState<PendingChange | null>(null);

  const confirmChange = async () => {
    if (!pending) return;

    await setUserRole(pending.user.id, pending.role);
    setPending(null);
    await users.reload();
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Users"
        description="Promote a student to teacher so they can create scenarios and review their learners' reports."
      />

      {users.error && <Alert>{users.error}</Alert>}
      {users.items === null && !users.error && <Spinner />}

      {users.items && (
        <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-canvas">
          {users.items.map((user) => (
            <UserRow key={user.id} user={user} onRequest={(role) => setPending({ user, role })} />
          ))}
        </ul>
      )}

      {users.hasMore && (
        <div>
          <Button variant="secondary" disabled={users.loadingMore} onClick={() => void users.loadMore()}>
            {users.loadingMore ? "Loading…" : "Show more users"}
          </Button>
        </div>
      )}

      {pending && (
        <ConfirmDialog
          title={
            pending.role === "teacher"
              ? `Promote ${pending.user.email} to teacher?`
              : `Remove teacher access from ${pending.user.email}?`
          }
          text={
            pending.role === "teacher"
              ? "They will be able to create scenarios and review the reports and conversations of learners in them."
              : "They will become a student. They keep their scenarios and can still edit or delete the ones they created, but they can no longer create scenarios or review learner reports."
          }
          confirmLabel={pending.role === "teacher" ? "Promote" : "Remove access"}
          pendingLabel="Saving…"
          tone={pending.role === "teacher" ? "primary" : "danger"}
          onConfirm={confirmChange}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

function UserRow({ user, onRequest }: { user: AdminUser; onRequest: (role: PendingChange["role"]) => void }) {
  return (
    <li className="group flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card font-medium text-ink"
        >
          {user.email.charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-base text-ink">{user.email}</span>
          <RolePill role={user.role as Role} />
        </div>
      </div>

      {user.role === "student" && (
        <button
          type="button"
          aria-label={`Promote ${user.email} to teacher`}
          title="Promote to teacher"
          onClick={() => onRequest("teacher")}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-success/15 text-body-strong opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <ArrowUpIcon />
        </button>
      )}

      {user.role === "teacher" && (
        <button
          type="button"
          aria-label={`Remove teacher access from ${user.email}`}
          title="Remove teacher access"
          onClick={() => onRequest("student")}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-error/15 text-body-strong opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <ArrowDownIcon />
        </button>
      )}
    </li>
  );
}

function RolePill({ role }: { role: Role }) {
  if (role === "teacher") {
    return <Badge tone="success">Teacher</Badge>;
  }

  if (role === "superadmin") {
    return <Badge tone="dark">Superadmin</Badge>;
  }

  return <Badge tone="neutral">Student</Badge>;
}
