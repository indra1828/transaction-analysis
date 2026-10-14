import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currentTheme, initTheme, setTheme } from "./theme";

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initTheme", () => {
  it("follows the system setting when nothing is saved", () => {
    systemPrefersDark(true);
    initTheme();
    expect(currentTheme()).toBe("dark");
  });

  it("uses the saved choice over the system setting", () => {
    localStorage.setItem("theme", "light");
    systemPrefersDark(true);
    initTheme();
    expect(currentTheme()).toBe("light");
  });

  it("stays light by default on a light system", () => {
    systemPrefersDark(false);
    initTheme();
    expect(currentTheme()).toBe("light");
  });
});

describe("setTheme", () => {
  it("applies the theme and remembers it", () => {
    systemPrefersDark(false);
    setTheme("dark");
    expect(currentTheme()).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
