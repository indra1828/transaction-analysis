import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";

import { Alert } from "../components/Alert";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/buttonStyles";
import { Field, TextArea } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { ScenarioFields } from "../components/ScenarioFields";
import { ScenarioForm } from "../components/ScenarioForm";
import { VisibilityChoice } from "../components/VisibilityChoice";
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

// Two steps on one page. First the five answers, which disappear once the
// assistant has written the scenario. Then only the generated scenario, with
// the options to update or save it.
export function NewScenarioPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<ScenarioAnswers>(EMPTY_ANSWERS);
  const [draft, setDraft] = useState<DraftText | null>(null);
  const [feedback, setFeedback] = useState("");
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shared, setShared] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Writes the scenario from the answers. With `revise`, it applies the feedback to the current draft.
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
      if (revise) setFeedback("");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setWorking(false);
    }
  };

  const startOver = () => {
    setAnswers(EMPTY_ANSWERS);
    setDraft(null);
    setFeedback("");
    setError(null);
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
      const scenario = textToDraft(draft);
      const saved = await createScenario(scenario.title, scenario.config, shared);
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
        description="Set up a workplace conversation to practise. Answer five questions and the assistant writes the AI character and when the conversation ends. Review everything, then choose whether every user can see it."
      />

      {draft ? (
        <section className="flex flex-col gap-8 rounded-lg bg-card p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl">Review the scenario</h2>
            <p className="text-sm leading-relaxed text-muted">
              The assistant wrote these parts from your answers. Change anything you like before you save.
            </p>
          </div>

          <ScenarioFields value={draft} onChange={setDraft} />

          <div className="flex flex-col gap-4 border-t border-hairline pt-6">
            <Field
              label="Want something different?"
              hint="Say what should change, for example: make the AI character more defensive."
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

          <VisibilityChoice shared={shared} onChange={setShared} />

          <div className="flex flex-wrap items-center gap-6">
            <Button disabled={saving || working} onClick={() => void save()} className="h-12 px-6 text-base">
              {saving ? "Saving…" : "Save scenario"}
            </Button>
            <button type="button" onClick={startOver} className={buttonClasses("text", "text-sm")}>
              Start over
            </button>
          </div>
        </section>
      ) : (
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
              {working ? "Creating…" : "Create scenario"}
            </Button>
          </div>
        </form>
      )}

      {error && <Alert>{error}</Alert>}
    </div>
  );
}
