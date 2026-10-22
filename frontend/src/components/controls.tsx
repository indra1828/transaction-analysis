import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";

// Pill-shaped controls, so filters match the rounded cards they sit above.
const pillBase =
  "rounded-full border border-hairline bg-canvas text-sm text-ink outline-none transition-colors hover:border-muted-soft focus:border-primary focus:ring-3 focus:ring-primary/15";

export function PillSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${pillBase} h-11 appearance-none py-2 pl-5 pr-11 ${props.className ?? ""}`} />
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export function PillSearch({ icon, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
      <input
        {...props}
        className={`${pillBase} h-11 w-full py-2 placeholder:text-muted-soft ${icon ? "pl-11" : "pl-5"} pr-5 ${props.className ?? ""}`}
      />
    </div>
  );
}

export function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
