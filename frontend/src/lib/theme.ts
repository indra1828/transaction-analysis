export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Runs before the first render so the page never flashes the wrong theme.
// A saved choice wins; otherwise the system setting is used.
export function initTheme() {
  let saved: string | null = null;

  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode); fall back to the system setting.
  }

  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const theme: Theme = saved === "dark" || saved === "light" ? saved : systemDark ? "dark" : "light";

  applyTheme(theme);
}

export function setTheme(theme: Theme) {
  applyTheme(theme);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The choice still applies for this visit.
  }
}
