import { Navigate } from "react-router";

import { buttonClasses } from "../components/buttonStyles";
import { Spinner } from "../components/Spinner";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../auth/useAuth";
import { GOOGLE_LOGIN_URL } from "../api";

// Landing page for signed-out visitors. Layout: brand and tag across the top,
// headline, subline and call to action centred, a line of phrases at the bottom.
export function LoginPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col px-6 sm:px-10">
      <header className="flex items-center justify-between py-8">
        <span className="font-display text-3xl text-ink">
          samvada<span className="text-primary">.ai</span>
        </span>
        <div className="flex items-center gap-6">
          <span className="hidden text-sm font-medium uppercase tracking-[0.2em] text-muted sm:inline">
            AI conversation coach
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-6xl sm:text-7xl lg:text-8xl">Speak. Reflect. Grow.</h1>
          <p className="text-2xl text-body sm:text-3xl">Find the words. Understand the why.</p>
        </div>
        <a
          href={GOOGLE_LOGIN_URL}
          className={buttonClasses("primary", "h-14 rounded-full px-9 text-lg")}
        >
          Start a conversation <span aria-hidden="true">↗</span>
        </a>
      </main>

      <footer className="py-10 text-center text-base text-muted">
        Practice conversations · Explore patterns · Build awareness
      </footer>
    </div>
  );
}
