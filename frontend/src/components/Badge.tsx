import type { ReactNode } from "react";

const tones = {
  neutral: "bg-card text-ink",
  primary: "bg-primary text-on-primary",
  success: "bg-success/15 text-body-strong",
  warning: "bg-amber/20 text-body-strong",
  danger: "bg-error/15 text-body-strong",
  dark: "bg-dark text-on-dark",
};

export type BadgeTone = keyof typeof tones;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
