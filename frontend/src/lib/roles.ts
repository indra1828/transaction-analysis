import type { User } from "../api";

// Mirrors the server. The server enforces these rules; this only decides what to show.
export const canTeach = (user: User) => user.role === "teacher" || user.role === "superadmin";

export const isSuperAdmin = (user: User) => user.role === "superadmin";
