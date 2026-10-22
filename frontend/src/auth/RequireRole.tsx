import { Navigate, Outlet } from "react-router";

import type { User } from "../api";
import { useAuth } from "./useAuth";

// Layout route for pages only some roles may open. Others are sent to the home page.
export function RequireRole({ allow }: { allow: (user: User) => boolean }) {
  const { user } = useAuth();

  if (!user || !allow(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
