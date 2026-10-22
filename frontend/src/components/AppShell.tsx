import { Link, NavLink, Outlet, useMatch } from "react-router";

import { useAuth } from "../auth/useAuth";
import { canTeach } from "../lib/roles";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "./ThemeToggle";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${isActive ? "text-ink" : "text-muted hover:text-ink"}`;

const YEAR = new Date().getFullYear();

// Top bar with navigation for signed-in pages.
// A conversation fills the window: its chat scrolls inside its own panel, so
// the page never scrolls and the footer is left out.
export function AppShell() {
  const { user } = useAuth();
  const inConversation = useMatch({ path: "/threads/:id", end: true }) !== null;


  return (
    <div className={inConversation ? "flex h-dvh flex-col" : "flex min-h-screen flex-col"}>
      <header className="sticky top-0 z-10 shrink-0 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link to="/" className="font-display text-2xl text-ink">
              samvada<span className="text-primary">.ai</span>
            </Link>
            <nav className="flex items-center gap-6">
              <NavLink to="/" end className={navClass}>
                Scenarios
              </NavLink>
              <NavLink to="/scenarios/new" className={navClass}>
                New Scenario
              </NavLink>
              {user && canTeach(user) && (
                <NavLink to="/teacher" className={navClass}>
                  Dashboard
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </div>
      </header>

      {inConversation ? (
        <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-6 py-6">
          <Outlet />
        </main>
      ) : (
        <>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
            <Outlet />
          </main>
          <footer className="border-t border-hairline">
            <p className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-muted-soft">
              © {YEAR} samvada.ai. All rights reserved.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
