import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";

import { Alert } from "../components/Alert";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { Field, TextArea, TextInput } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { ScenarioForm } from "../components/ScenarioForm";
import { createScenario, draftScenario } from "../api";
import { messageOf } from "../hooks/useAsync";
import {
  EMPTY_ANSWERS,
  draftToText,
  textToDraft,
  toDraftInput,
  validateAnswers,
  validateDraft,
} from "../lib/scenario";
import type { DraftText, ScenarioAnswers } from "../lib/scenario";

export function NewScenarioPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<ScenarioAnswers>(EMPTY_ANSWERS);
  const [draft, setDraft] = useState<DraftText | null>(null);
  // The answers the current draft was written from, to spot when they changed.
  const [draftedFrom, setDraftedFrom] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = draft !== null && draftedFrom !== JSON.stringify(answers);

  // Creates a draft from the answers. With `revise`, it also applies the feedback.
  const createDraft = async (revise: boolean) => {
    const problem = validateAnswers(answers);

    if (problem) {
      setError(problem);
      return;
    }

    setWorking(true);
    setError(null);

    try {
      const current = revise && draft ? draft : undefined;
      const result = await draftScenario(toDraftInput(answers, current, revise ? feedback : undefined));
      setDraft(draftToText(result));
      setDraftedFrom(JSON.stringify(answers));
      if (revise) setFeedback("");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setWorking(false);
    }
  };

  const save = async () => {
    if (!draft) return;

    const problem = validateDraft(draft);

    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const scenario = textToDraft(draft, answers.yourRole.trim());
      const saved = await createScenario(scenario.title, scenario.config);
      navigate(`/scenarios/${saved.id}`);
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12">
      <BackLink to="/">All scenarios</BackLink>

      <PageHeader
        title="New Scenario"
        description="Set up a workplace conversation to practise. Answer five questions, and the assistant writes the character's opening line and when the conversation ends. You can review everything before you save. Only you can see the scenarios you create."
      />

      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void createDraft(false);
        }}
        className="flex flex-col gap-8"
      >
        <ScenarioForm value={answers} onChange={setAnswers} />
        <div>
          <Button type="submit" variant="secondary" disabled={working}>
            {working ? "Creating…" : draft ? "Create again from these answers" : "Create scenario"}
          </Button>
        </div>
      </form>

      {draft && (
        <section className="flex flex-col gap-8 rounded-lg bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl">Review the scenario</h2>
            <p className="text-sm leading-relaxed text-muted">
              The assistant wrote these parts from your answers. Change anything you like before you save.
            </p>
            {stale && (
              <p className="text-sm font-medium text-body-strong">
                Your answers have changed since this was written. Create again to update it.
              </p>
            )}
          </div>

          <DraftFields value={draft} onChange={setDraft} />

          <div className="flex flex-col gap-4 border-t border-hairline pt-6">
            <Field
              label="Want something different?"
              hint="Say what should change, for example: make the character more defensive."
            >
              {(id) => (
                <TextArea id={id} rows={2} maxLength={1000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              )}
            </Field>
            <div>
              <Button variant="secondary" disabled={working || !feedback.trim()} onClick={() => void createDraft(true)}>
                {working ? "Updating…" : "Update the scenario"}
              </Button>
            </div>
          </div>

          <div>
            <Button disabled={saving || working} onClick={() => void save()} className="h-12 px-6 text-base">
              {saving ? "Saving…" : "Save scenario"}
            </Button>
          </div>
        </section>
      )}

      {error && <Alert>{error}</Alert>}
    </div>
  );
}

function DraftFields({ value, onChange }: { value: DraftText; onChange: (value: DraftText) => void }) {
  const set = (patch: Partial<DraftText>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-7">
      <Field label="Name">
        {(id) => <TextInput id={id} maxLength={180} value={value.title} onChange={(e) => set({ title: e.target.value })} />}
      </Field>

      <Field label="The character" hint="How the character thinks, speaks and reacts under pressure.">
        {(id) => (
          <TextArea id={id} rows={3} value={value.persona} onChange={(e) => set({ persona: e.target.value })} />
        )}
      </Field>

      <Field label="Scenario" hint="The background both of you know.">
        {(id) => <TextArea id={id} rows={3} value={value.context} onChange={(e) => set({ context: e.target.value })} />}
      </Field>

      <Field label="Opening line" hint="The character's first words in the conversation.">
        {(id) => (
          <TextInput id={id} value={value.openingLine} onChange={(e) => set({ openingLine: e.target.value })} />
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
