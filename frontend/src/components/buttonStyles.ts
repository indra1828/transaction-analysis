export type ButtonVariant = "primary" | "secondary" | "text";

const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md px-5 font-sans text-sm font-medium leading-none transition-colors outline-none focus-visible:ring-3 focus-visible:ring-primary/30 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-active active:bg-primary-active disabled:bg-primary-disabled disabled:text-muted",
  secondary:
    "border border-hairline bg-canvas text-ink hover:border-muted-soft hover:bg-card active:bg-surface disabled:text-muted",
  text: "h-auto px-0 text-primary underline-offset-4 hover:underline disabled:text-muted",
};

// Shared by <button> and link-styled <a>/<Link> elements.
export function buttonClasses(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
