import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listUsers, setUserRole } from "../../api";
import { UsersPage } from "./UsersPage";

vi.mock("../../api", () => ({
  listUsers: vi.fn(),
  setUserRole: vi.fn(),
}));

const users = [
  { id: "u1", email: "priya@example.com", role: "student" as const },
  { id: "u2", email: "arjun@example.com", role: "teacher" as const },
  { id: "u3", email: "root@example.com", role: "superadmin" as const },
];

beforeEach(() => {
  vi.mocked(listUsers).mockReset();
  vi.mocked(listUsers).mockResolvedValue(users);
  vi.mocked(setUserRole).mockReset();
  vi.mocked(setUserRole).mockResolvedValue({ ...users[0], role: "teacher" });
});

afterEach(() => {
  cleanup();
});

describe("UsersPage", () => {
  it("shows students a promote arrow and teachers a remove arrow, and superadmins neither", async () => {
    render(<UsersPage />);

    expect(await screen.findByRole("button", { name: "Promote priya@example.com to teacher" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove teacher access from arjun@example.com" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /root@example.com/ })).toBeNull();
  });

  it("asks for confirmation before promoting, and changes nothing if cancelled", async () => {
    render(<UsersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Promote priya@example.com to teacher" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Promote priya@example.com to teacher?")).toBeTruthy();
    expect(setUserRole).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(setUserRole).not.toHaveBeenCalled();
  });

  it("promotes the user only after confirmation", async () => {
    render(<UsersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Promote priya@example.com to teacher" }));
    fireEvent.click(screen.getByRole("button", { name: "Promote" }));

    await waitFor(() => expect(setUserRole).toHaveBeenCalledWith("u1", "teacher"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
