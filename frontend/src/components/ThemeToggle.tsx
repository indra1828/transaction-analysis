import { useState } from "react";

import { currentTheme, setTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

// Round icon button, styled like the account circle but a little translucent.
// The icon shows the mode the click switches to.
export function ThemeToggle() {
  const [theme, setLocal] = useState<Theme>(currentTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  const switchTheme = () => {
    setTheme(next);
    setLocal(next);
  };

  return (
    <button
      type="button"
      onClick={switchTheme}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex size-9 cursor-pointer items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-card hover:text-ink focus-visible:ring-3 focus-visible:ring-primary/30"
    >
      {next === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
