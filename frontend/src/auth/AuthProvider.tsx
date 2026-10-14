import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { getMe, logout as logoutRequest } from "../api";
import type { User } from "../api";
import { AuthContext } from "./authContext";

// Loads the signed-in user once. A failed check counts as signed out.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, logout }), [user, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
