import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteThread } from "../api";
import { DeleteConversation } from "./DeleteConversation";

vi.mock("../api", () => ({ deleteThread: vi.fn() }));

const mockedDelete = vi.mocked(deleteThread);

beforeEach(() => {
  mockedDelete.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("DeleteConversation", () => {
  it("asks for confirmation before deleting anything", () => {
    const onDeleted = vi.fn();
    render(<DeleteConversation threadId="t1" onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("dialog", { name: "Delete this conversation?" })).toBeTruthy();
    expect(mockedDelete).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("does nothing when the person cancels", () => {
    render(<DeleteConversation threadId="t1" onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockedDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("deletes the conversation after confirmation and reports success", async () => {
    mockedDelete.mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<DeleteConversation threadId="t1" onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(mockedDelete).toHaveBeenCalledWith("t1");
  });

  it("keeps the conversation and shows the error when deleting fails", async () => {
    mockedDelete.mockRejectedValue(new Error("A reply is still being generated."));
    const onDeleted = vi.fn();
    render(<DeleteConversation threadId="t1" onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/generated/);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
