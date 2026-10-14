import { Navigate, Outlet } from "react-router";

import { Spinner } from "../components/Spinner";
import { useAuth } from "./useAuth";

// Layout route: renders children only for a signed-in user.
export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
