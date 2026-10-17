import { Field, TextArea, TextInput } from "./Field";
import type { ScenarioAnswers } from "../lib/scenario";

interface ScenarioFormProps {
  value: ScenarioAnswers;
  onChange: (value: ScenarioAnswers) => void;
}

// The five answers that drive the scenario.
export function ScenarioForm({ value, onChange }: ScenarioFormProps) {
  const set = (patch: Partial<ScenarioAnswers>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-8">
      <Field label="Name" hint="Name of the scenario, for example: Missed Deadline">
        {(id) => (
          <TextInput id={id} maxLength={180} value={value.title} onChange={(e) => set({ title: e.target.value })} />
        )}
      </Field>

      <div className="grid gap-8 md:grid-cols-2">
        <Field label="You are" hint="Your role in this conversation, for example: Team manager">
          {(id) => (
            <TextInput id={id} maxLength={120} value={value.yourRole} onChange={(e) => set({ yourRole: e.target.value })} />
          )}
        </Field>

        <Field label="AI Character" hint="The role the AI plays, for example: Analyst who missed the deadline">
          {(id) => (
            <TextInput id={id} maxLength={120} value={value.theirRole} onChange={(e) => set({ theirRole: e.target.value })} />
          )}
        </Field>
      </div>

      <Field
        label="Scenario"
        hint="What has happened so far and why this conversation matters now. Two or three sentences."
      >
        {(id) => (
          <TextArea id={id} rows={4} maxLength={1000} value={value.situation} onChange={(e) => set({ situation: e.target.value })} />
        )}
      </Field>

      <Field
        label="What you want to achieve"
        hint="Your goals, one point per line, for example: Understand why the report was late"
      >
        {(id) => (
          <TextArea id={id} rows={4} maxLength={1000} value={value.goals} onChange={(e) => set({ goals: e.target.value })} />
        )}
      </Field>
    </div>
  );
}
