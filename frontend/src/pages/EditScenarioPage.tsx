import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useAuth } from "../auth/useAuth";
import { Alert } from "../components/Alert";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/buttonStyles";
import { PageHeader } from "../components/PageHeader";
import { ScenarioFields } from "../components/ScenarioFields";
import { VisibilityChoice } from "../components/VisibilityChoice";
import { Spinner } from "../components/Spinner";
import { getScenario, updateScenario } from "../api";
import type { Scenario } from "../api";
import { messageOf, useAsync } from "../hooks/useAsync";
import { canTeach } from "../lib/roles";
import { scenarioToText, textToUpdate, validateDraft } from "../lib/scenario";
import type { DraftText } from "../lib/scenario";

// Edits a scenario its creator made. Changes apply to new conversations only;
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

  if (!scenario.data.editable) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to={`/scenarios/${id}`}>Back to scenario</BackLink>
        <Alert>Only the person who created this scenario can change it.</Alert>
      </div>
    );
  }

  return <ScenarioEditor key={id} scenario={scenario.data} />;
}

function ScenarioEditor({ scenario }: { scenario: Scenario }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const teacher = user !== null && canTeach(user);
  const [text, setText] = useState<DraftText>(() => scenarioToText(scenario));
  const [shared, setShared] = useState(scenario.is_shared);
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
      // Only teachers can change sharing. A former teacher's shared scenario keeps its sharing.
      await updateScenario(scenario.id, { ...textToUpdate(text), ...(teacher ? { is_shared: shared } : {}) });
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

        {teacher ? (
          <VisibilityChoice shared={shared} onChange={setShared} />
        ) : (
          <p className="text-sm leading-relaxed text-muted">Only you can see this scenario.</p>
        )}

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
