export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-hairline border-t-primary" />
      {label}
    </div>
  );
}
