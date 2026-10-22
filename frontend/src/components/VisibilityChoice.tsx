import { useId } from "react";

interface VisibilityChoiceProps {
  shared: boolean;
  onChange: (shared: boolean) => void;
}

const OPTIONS = [
  {
    shared: true,
    title: "Global",
    description: "Every user can see and practise this scenario.",
  },
  {
    shared: false,
    title: "Private",
    description: "Only you can see this scenario. Learners cannot.",
  },
];

// Teachers choose whether a scenario is shared with every user or kept to themselves.
export function VisibilityChoice({ shared, onChange }: VisibilityChoiceProps) {
  const name = useId();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-body-strong">Who can see this scenario?</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = shared === option.shared;

          return (
            <label
              key={option.title}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border bg-canvas p-4 transition-colors ${
                selected ? "border-primary" : "border-hairline hover:border-muted-soft"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name={name}
                  checked={selected}
                  onChange={() => onChange(option.shared)}
                  className="size-4 accent-primary"
                />
                <span className="text-base font-medium text-ink">{option.title}</span>
              </span>
              <span className="pl-7 text-sm text-muted">{option.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
