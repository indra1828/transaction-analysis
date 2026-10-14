import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// Catches render errors so one broken screen shows a message instead of a
// blank page. Reloading the page is the recovery path.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-4xl">Something went wrong</h1>
        <p className="max-w-md text-muted">
          The page could not be shown. Reload to try again. Your conversations are saved.
        </p>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-on-primary active:bg-primary-active"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
