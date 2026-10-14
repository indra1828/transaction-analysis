import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { ChatTextArea } from "../../components/ChatTextArea";
import { PencilIcon } from "../../components/icons";
import type { Message } from "../../api";
import { messageOf } from "../../hooks/useAsync";

// A reply that is still streaming. `user` is set when the learner's message
// was just sent and is not yet in the saved history.
export interface PendingReply {
  user: string | null;
  reply: string;
}

interface TranscriptProps {
  messages: Message[];
  pending: PendingReply | null;
  canEdit: boolean;
  onEdit: (messageId: string, content: string) => Promise<void>;
}

// The scrolling part of the chat. Only this region scrolls; the page does not.
export function Transcript({ messages, pending, canEdit, onEdit }: TranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view, inside this region only.
  useEffect(() => {
    const region = scrollRef.current;
    if (region) region.scrollTop = region.scrollHeight;
  }, [messages.length, pending?.user, pending?.reply]);

  return (
    <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-6 sm:px-8">
      {messages.length === 0 && !pending && (
        <p className="m-auto text-sm text-muted">The conversation is starting…</p>
      )}

      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} message={message} canEdit={canEdit} onEdit={onEdit} />
        ) : (
          <CharacterBubble key={message.id} text={message.content} />
        ),
      )}

      {pending && (
        <>
          {pending.user && (
            <UserBubble>
              <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">{pending.user}</p>
            </UserBubble>
          )}
          <CharacterBubble text={pending.reply} streaming />
        </>
      )}
    </div>
  );
}

function UserBubble({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex max-w-[80%] flex-col items-end gap-2 self-end ${wide ? "w-[80%]" : ""}`}>
      <span className="text-xs font-medium text-muted">You</span>
      <div className="flex w-full flex-col gap-2 rounded-2xl rounded-br-md bg-card px-4 py-3">{children}</div>
    </div>
  );
}

function CharacterBubble({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <div className="flex max-w-[80%] flex-col items-start gap-2 self-start">
      <span className="text-xs font-medium text-muted">Character</span>
      <div className="rounded-2xl rounded-bl-md border border-hairline bg-canvas px-4 py-3">
        <p className="whitespace-pre-wrap text-base leading-relaxed text-body">
          {text}
          {streaming && <span className="ml-0.5 inline-block animate-pulse text-primary">▍</span>}
        </p>
      </div>
    </div>
  );
}

// One learner message. It shows the text with a pencil; pressing the pencil
// turns that same bubble into the editor, so the text is never shown twice.
// Sending from the editor starts a new simulation from this message (the
// character replies to the edited message).
function UserMessage({
  message,
  canEdit,
  onEdit,
}: {
  message: Message;
  canEdit: boolean;
  onEdit: (messageId: string, content: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = () => {
    setText(message.content);
    setError(null);
    setEditing(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const content = text.trim();
    if (!content || saving) return;

    setSaving(true);
    setError(null);

    try {
      await onEdit(message.id, content);
      // The edited text is now in the conversation; close the editor.
      setEditing(false);
      setSaving(false);
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <UserBubble wide>
        <form onSubmit={submit} className="flex w-full flex-col gap-3">
          <ChatTextArea
            aria-label="Edit your message"
            rows={2}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <Alert>{error}</Alert>}
          <div className="flex gap-3">
            <Button type="submit" aria-label="Send edited message" disabled={saving || !text.trim()} className="h-9 px-4 text-sm">
              {saving ? "Sending…" : "Send"}
            </Button>
            <Button variant="secondary" className="h-9 px-4 text-sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </UserBubble>
    );
  }

  return (
    <UserBubble>
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 whitespace-pre-wrap text-base leading-relaxed text-ink">{message.content}</p>
        {canEdit && (
          <button
            type="button"
            onClick={startEditing}
            aria-label="Edit this message and send a different reply"
            title="Edit and send a different reply"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-3 focus-visible:ring-primary/30"
          >
            <PencilIcon />
          </button>
        )}
      </div>
    </UserBubble>
  );
}
