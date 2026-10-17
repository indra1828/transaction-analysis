import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Alert } from "../components/Alert";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/buttonStyles";
import { PageHeader } from "../components/PageHeader";
import { ScenarioFields } from "../components/ScenarioFields";
import { Spinner } from "../components/Spinner";
import { getScenario, updateScenario } from "../api";
import type { Scenario } from "../api";
import { messageOf, useAsync } from "../hooks/useAsync";
import { scenarioToText, textToUpdate, validateDraft } from "../lib/scenario";
import type { DraftText } from "../lib/scenario";

// Edits a scenario the user created. Changes apply to new conversations only;
// conversations already started keep the scenario they began with.
export function EditScenarioPage() {
  const { id = "" } = useParams();
  const scenario = useAsync(() => getScenario(id), id);

  if (scenario.loading) return <Spinner />;

  if (scenario.error || !scenario.data) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to="/">All scenarios</BackLink>
        <Alert>{scenario.error ?? "Scenario not found"}</Alert>
      </div>
    );
  }

  if (scenario.data.is_public) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to={`/scenarios/${id}`}>Back to scenario</BackLink>
        <Alert>Built-in scenarios cannot be changed.</Alert>
      </div>
    );
  }

  return <ScenarioEditor key={id} scenario={scenario.data} />;
}

function ScenarioEditor({ scenario }: { scenario: Scenario }) {
  const navigate = useNavigate();
  const [text, setText] = useState<DraftText>(() => scenarioToText(scenario));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const problem = validateDraft(text);

    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateScenario(scenario.id, textToUpdate(text));
      navigate(`/scenarios/${scenario.id}`);
    } catch (err) {
      setError(messageOf(err));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12">
      <BackLink to={`/scenarios/${scenario.id}`}>Back to scenario</BackLink>

      <PageHeader title="Edit scenario" description="Change any part of this scenario. Conversations you have already started keep the version they began with." />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="flex flex-col gap-8 rounded-lg bg-card p-6 sm:p-8"
      >
        <ScenarioFields value={text} onChange={setText} />

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-wrap items-center gap-6">
          <Button type="submit" disabled={saving} className="h-12 px-6 text-base">
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Link to={`/scenarios/${scenario.id}`} className={buttonClasses("text", "text-sm")}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
