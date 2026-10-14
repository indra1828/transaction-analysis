import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { buttonClasses } from "../../components/buttonStyles";
import type { TurnRevision } from "../../api";

interface DraftFeedbackProps {
  revision: TurnRevision; // the latest version of the draft
  disabled: boolean;
  onUse: (text: string) => void; // put the suggested wording into the reply bar
  onSend: () => void; // send the draft to the character
}

// The coach's view of a draft that has not been sent yet. It sits above the
// reply bar, like a message in the chat that the learner can act on.
export function DraftFeedback({ revision, disabled, onUse, onSend }: DraftFeedbackProps) {
  const { content, feedback } = revision;
  const suggestionDiffers = feedback.suggested_response.trim() !== content.trim();

  return (
    <div className="flex flex-col gap-3 border-t border-hairline bg-card px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted">Coach</span>
        <Badge tone={feedback.acceptable ? "success" : "warning"}>
          {feedback.acceptable ? "Ready to send" : "Could be stronger"}
        </Badge>
      </div>

      <p className="text-sm leading-relaxed text-body">{feedback.feedback}</p>

      {suggestionDiffers && (
        <div className="flex flex-col gap-2 rounded-md bg-canvas p-3">
          <p className="text-sm leading-relaxed text-ink">“{feedback.suggested_response}”</p>
          <button
            type="button"
            onClick={() => onUse(feedback.suggested_response)}
            className={buttonClasses("text", "self-start text-sm")}
          >
            Use this instead
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-muted">Your draft: “{content}”</p>
        <Button disabled={disabled} onClick={onSend} className="h-9 px-4 text-sm">
          Send to character
        </Button>
      </div>
    </div>
  );
}
