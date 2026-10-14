import type { ReactNode } from "react";
import { Link } from "react-router";

// One consistent back control: an arrow and a muted label, aligned to the
// content it belongs to.
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 self-start text-sm font-medium text-muted transition-colors hover:text-ink"
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
