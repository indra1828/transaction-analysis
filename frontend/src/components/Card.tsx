import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  tone?: "card" | "canvas" | "accent" | "dark";
  className?: string;
}

// Light mode: boxes use the card colour (#efe9de), and accent boxes the coral
// primary (#cc785c). Dark mode gets its own values from the theme tokens.
const tones = {
  card: "bg-card text-ink",
  canvas: "bg-card text-ink",
  accent: "bg-primary text-on-primary",
  dark: "bg-dark text-on-dark",
};

export function Card({ children, tone = "canvas", className = "" }: CardProps) {
  return <section className={`rounded-lg p-6 sm:p-8 ${tones[tone]} ${className}`}>{children}</section>;
}
