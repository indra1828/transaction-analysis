import { useLayoutEffect, useRef } from "react";
import type { KeyboardEvent, TextareaHTMLAttributes } from "react";

// Compact by design: one line high, growing with the text up to about six
// lines, then scrolling.
const classes =
  "block w-full min-h-11 max-h-40 resize-none overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-base leading-normal text-panel-body outline-none transition-colors placeholder:text-panel-muted hover:border-muted-soft focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:bg-surface disabled:text-muted";

// A message box: Enter submits the enclosing form, Shift+Enter starts a new
// line. Enter is ignored while an input method is composing text (IME).
export function ChatTextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Size to the content. Resetting to auto first lets the box shrink again
  // when text is deleted.
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;

    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [props.value]);

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    props.onKeyDown?.(event);

    if (event.defaultPrevented) return;

    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      {...props}
      onKeyDown={submitOnEnter}
      className={`${classes} ${className}`.trim()}
    />
  );
}
