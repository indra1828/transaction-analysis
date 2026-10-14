import type { ReactNode } from "react";

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
      {children}
    </div>
  );
}
