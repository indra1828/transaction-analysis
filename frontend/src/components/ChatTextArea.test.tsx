import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatTextArea } from "./ChatTextArea";

function renderForm(onSubmit: () => void) {
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <ChatTextArea aria-label="Message" defaultValue="hello" />
    </form>,
  );
  return screen.getByLabelText("Message");
}

describe("ChatTextArea", () => {
  afterEach(cleanup);

  it("sends the form on Enter", () => {
    const onSubmit = vi.fn();
    const box = renderForm(onSubmit);

    fireEvent.keyDown(box, { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("starts a new line on Shift+Enter and does not send", () => {
    const onSubmit = vi.fn();
    const box = renderForm(onSubmit);

    const notPrevented = fireEvent.keyDown(box, { key: "Enter", shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true); // the browser inserts the line break
  });

  it("does not send while an input method is composing text", () => {
    const onSubmit = vi.fn();
    const box = renderForm(onSubmit);

    fireEvent.keyDown(box, { key: "Enter", isComposing: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
