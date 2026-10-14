import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowMenu } from "./RowMenu";

afterEach(() => {
  cleanup();
});

function setup() {
  const onView = vi.fn();
  const onDelete = vi.fn();
  render(
    <RowMenu
      label="More options for Missed Deadline"
      items={[
        { label: "View report", onSelect: onView },
        { label: "Delete", danger: true, onSelect: onDelete },
      ]}
    />,
  );
  return { onView, onDelete };
}

describe("RowMenu", () => {
  it("is closed until the three-dot button is pressed", () => {
    setup();

    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More options for Missed Deadline" }));

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["View report", "Delete"]);
  });

  it("runs the chosen action and closes", () => {
    const { onDelete } = setup();

    fireEvent.click(screen.getByRole("button", { name: "More options for Missed Deadline" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Escape and on an outside click without acting", () => {
    const { onView, onDelete } = setup();

    fireEvent.click(screen.getByRole("button", { name: "More options for Missed Deadline" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More options for Missed Deadline" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    expect(onView).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
