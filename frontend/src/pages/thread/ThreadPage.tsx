import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Alert } from "../../components/Alert";
import { Badge } from "../../components/Badge";
import { BackLink } from "../../components/BackLink";
import { Button } from "../../components/Button";
import { buttonClasses } from "../../components/buttonStyles";
import { Spinner } from "../../components/Spinner";
import {
  completeThread,
  createTurn,
  getScenario,
  getThread,
  listMessages,
  listTurns,
  reviseTurn,
  streamAcceptTurn,
  streamEditMessage,
  streamMessage,
  type Message,
  type StreamHandlers,
  type Thread,
  type Turn,
} from "../../api";
import { messageOf, useAsync } from "../../hooks/useAsync";
import { MODE_LABEL, STATUS_LABEL } from "../../lib/format";
import { Composer } from "./Composer";
import { DraftFeedback } from "./DraftFeedback";
import { Transcript } from "./Transcript";
import type { PendingReply } from "./Transcript";

interface Conversation {
  thread: Thread;
  messages: Message[];
  turns: Turn[];
  scenarioTitle: string;
}

async function loadConversation(id: string): Promise<Conversation> {
  const thread = await getThread(id);
  const [messages, turns, scenario] = await Promise.all([
    listMessages(id),
    thread.mode === "guided" ? listTurns(id) : Promise.resolve<Turn[]>([]),
    getScenario(thread.scenario_id).catch(() => null),
  ]);

  return {
    thread,
    messages,
    turns,
    scenarioTitle: scenario?.title ?? "Conversation",
  };
}

// Simulation and guided practice share this screen and its reply bar. The
// difference is only what sending does: a message in simulation, a draft for
// feedback in guided practice.
export function ThreadPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const conversation = useAsync(() => loadConversation(id), id);
  const { reload } = conversation;

  const [reply, setReply] = useState("");
  const [pending, setPending] = useState<PendingReply | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  // Runs one streamed reply, then reloads the saved history. The backend
  // removes the learner's message again if the reply fails, so the reload
  // is what keeps the screen accurate.
  const stream = useCallback(
    async (user: string | null, open: (handlers: StreamHandlers) => Promise<void>) => {
      setActionError(null);
      setPending({ user, reply: "" });

      const outcome: { error: string | null } = { error: null };

      try {
        await open({
          onDelta: (content) => setPending((p) => (p ? { ...p, reply: p.reply + content } : p)),
          onDone: () => undefined,
          onError: (detail) => {
            outcome.error = detail;
          },
        });
      } catch (err) {
        outcome.error = messageOf(err);
      }

      await reload();
      setPending(null);
      setActionError(outcome.error);

      return outcome.error === null;
    },
    [reload],
  );

  // Runs a non-streaming change, then reloads. Returns false on failure.
  const runAction = async (action: () => Promise<unknown>): Promise<boolean> => {
    setActionError(null);

    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      setActionError(messageOf(err));
      return false;
    }
  };

  const endConversation = async () => {
    setEnding(true);
    setActionError(null);

    try {
      await completeThread(id);
      navigate(`/threads/${id}/report`);
    } catch (err) {
      setActionError(messageOf(err));
      setEnding(false);
    }
  };

  if (conversation.loading) {
    return <Spinner />;
  }

  if (!conversation.data) {
    return <Alert>{conversation.error ?? "Conversation not found"}</Alert>;
  }

  const { thread, messages, turns, scenarioTitle } = conversation.data;
  const active = thread.status === "active";
  const guided = thread.mode === "guided";
  const busy = pending !== null || ending;
  const openDraft = guided ? turns.find((turn) => turn.status === "draft") : undefined;

  const learnerTurns = guided
    ? turns.filter((turn) => turn.status === "accepted").length
    : messages.filter((message) => message.role === "user").length;

  // Sends the reply bar's text. In guided practice a new draft gets feedback,
  // or the open draft is revised. The bar is cleared only when that succeeds.
  const send = async (text: string): Promise<boolean> => {
    let ok: boolean;

    if (!guided) {
      ok = await stream(text, (handlers) => streamMessage(id, text, handlers));
    } else if (openDraft) {
      ok = await runAction(() => reviseTurn(id, openDraft.id, text));
    } else {
      ok = await runAction(() => createTurn(id, text));
    }

    if (ok) setReply("");
    return ok;
  };

  const sendDraft = () => {
    if (openDraft) void stream(null, (handlers) => streamAcceptTurn(id, openDraft.id, handlers));
  };

  const placeholder = !guided
    ? "Type your reply"
    : openDraft
      ? "Change your draft, then send it for feedback"
      : "Write your next reply";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <BackLink to="/">All scenarios</BackLink>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-3xl">{scenarioTitle}</h1>
            <Badge>{MODE_LABEL[thread.mode]}</Badge>
            <Badge tone={active ? "neutral" : "success"}>{STATUS_LABEL[thread.status]}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-muted">
            {learnerTurns} of {thread.max_turns} turns
          </span>
          {active ? (
            <Button
              variant="secondary"
              className="h-9 px-4 text-sm"
              disabled={busy || learnerTurns === 0}
              onClick={() => void endConversation()}
            >
              {ending ? "Creating report…" : "Finish"}
            </Button>
          ) : (
            <Link to={`/threads/${id}/report`} className={buttonClasses("secondary", "h-9 px-4 text-sm")}>
              View report
            </Link>
          )}
        </div>
      </header>

      {conversation.error && <Alert>{conversation.error}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}

      {/* The chat panel has its own scroll area; the page itself does not scroll. */}
      <section className="flex min-h-[60dvh] flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-canvas">
        <Transcript
          messages={messages}
          pending={pending}
          canEdit={active && !guided && !busy}
          onEdit={async (messageId, content) => {
            // Edits the message in place; the reply to it streams in below.
            const saved = await stream(null, (handlers) => streamEditMessage(id, messageId, content, handlers));
            if (!saved) throw new Error("The edit could not be sent. Please try again.");
          }}
        />

        {active && guided && openDraft && (
          <DraftFeedback
            revision={openDraft.revisions[openDraft.revisions.length - 1]}
            disabled={busy}
            onUse={setReply}
            onSend={sendDraft}
          />
        )}

        {active && (
          <Composer
            value={reply}
            onChange={setReply}
            disabled={busy}
            placeholder={placeholder}
            onSend={send}
          />
        )}

        {!active && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-5">
            <p className="text-sm text-muted">This conversation is complete.</p>
            <Link to={`/threads/${id}/report`} className={buttonClasses("primary", "h-9 px-4 text-sm")}>
              Read the report
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
