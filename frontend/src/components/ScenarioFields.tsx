import { Field, TextArea, TextInput } from "./Field";
import type { DraftText } from "../lib/scenario";

interface ScenarioFieldsProps {
  value: DraftText;
  onChange: (value: DraftText) => void;
}

// Every editable part of a scenario. Used when reviewing a new scenario and
// when editing a saved one.
export function ScenarioFields({ value, onChange }: ScenarioFieldsProps) {
  const set = (patch: Partial<DraftText>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-7">
      <Field label="Name">
        {(id) => <TextInput id={id} maxLength={180} value={value.title} onChange={(e) => set({ title: e.target.value })} />}
      </Field>

      <Field label="You are" hint="Your role in this conversation.">
        {(id) => (
          <TextInput id={id} maxLength={120} value={value.yourRole} onChange={(e) => set({ yourRole: e.target.value })} />
        )}
      </Field>

      <Field label="AI Character" hint="How the AI character thinks, speaks and reacts under pressure.">
        {(id) => (
          <TextArea id={id} rows={3} maxLength={2000} value={value.persona} onChange={(e) => set({ persona: e.target.value })} />
        )}
      </Field>

      <Field label="Scenario" hint="The background both of you know.">
        {(id) => (
          <TextArea id={id} rows={3} maxLength={2000} value={value.context} onChange={(e) => set({ context: e.target.value })} />
        )}
      </Field>

      <Field label="Goals" hint="One point per line.">
        {(id) => (
          <TextArea id={id} rows={3} value={value.objectives} onChange={(e) => set({ objectives: e.target.value })} />
        )}
      </Field>

      <Field label="Ends when" hint="The conversation ends when one of these happens. One per line.">
        {(id) => (
          <TextArea
            id={id}
            rows={2}
            value={value.stoppingConditions}
            onChange={(e) => set({ stoppingConditions: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}
