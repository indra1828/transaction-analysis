import { Link } from "react-router";

import { buttonClasses } from "../components/buttonStyles";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-5xl">Page not found</h1>
      <p className="text-muted">The page you are looking for does not exist.</p>
      <Link to="/" className={buttonClasses("secondary")}>
        Back to scenarios
      </Link>
    </div>
  );
}
