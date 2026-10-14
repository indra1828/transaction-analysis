import type { FormEvent } from "react";

import { ChatTextArea } from "../../components/ChatTextArea";
import { SendIcon } from "../../components/icons";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder?: string;
  // The page decides what sending means and clears the text when it succeeds.
  onSend: (text: string) => Promise<boolean>;
}

// The message bar at the bottom of the chat, used by both simulation and guided
// practice. Enter sends, Shift+Enter adds a line.
export function Composer({ value, onChange, disabled, placeholder = "Type your reply", onSend }: ComposerProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();

    const content = value.trim();
    if (!content || disabled) return;

    void onSend(content);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-hairline p-3 sm:p-4">
      {/* The send button stretches to the height of the text box, so the two line up. */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <ChatTextArea
            aria-label="Your reply"
            maxLength={4000}
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <button
          type="submit"
          aria-label="Send"
          title="Send"
          disabled={disabled || !value.trim()}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-active focus-visible:ring-3 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:bg-primary-disabled disabled:text-muted"
        >
          <SendIcon className="size-5" />
        </button>
      </div>
      <p className="text-xs text-muted-soft">Enter to send · Shift + Enter for a new line</p>
    </form>
  );
}
