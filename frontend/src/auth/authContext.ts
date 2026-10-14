import { createContext } from "react";

import type { User } from "../api";

export interface AuthValue {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);
