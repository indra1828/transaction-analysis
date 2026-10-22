export type ViewChoice = "report" | "conversation";

interface ViewToggleProps {
  value: ViewChoice;
  onChange: (value: ViewChoice) => void;
  reportDisabled?: boolean;
}

const OPTIONS: { value: ViewChoice; label: string }[] = [
  { value: "report", label: "Report" },
  { value: "conversation", label: "Conversation" },
];

// Switches between a conversation's report and its full transcript.
export function ViewToggle({ value, onChange, reportDisabled = false }: ViewToggleProps) {
  return (
    <div role="tablist" aria-label="Choose what to show" className="inline-flex rounded-full border border-hairline bg-canvas p-1">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        const disabled = option.value === "report" && reportDisabled;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? "bg-primary text-on-primary" : "cursor-pointer text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
