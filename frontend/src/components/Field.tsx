import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";

const inputClasses =
  "w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 transition-colors hover:border-muted-soft font-sans text-base text-body outline-none placeholder:text-muted-soft focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:bg-surface disabled:text-muted";

interface FieldProps {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}

// Wraps one input with a visible label and optional hint text.
export function Field({ label, hint, children }: FieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-body-strong">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClasses} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // No resize handle: the box keeps one size, as in a chat app.
  return <textarea className={`${inputClasses} min-h-24 resize-none`} {...props} />;
}
