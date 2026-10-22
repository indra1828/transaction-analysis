import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Alert } from "../components/Alert";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Field, TextInput } from "../components/Field";
import { ScenarioBadge } from "../components/ScenarioBadge";
import { Spinner } from "../components/Spinner";
import { buttonClasses } from "../components/buttonStyles";
import { deleteScenario, getScenario, startThread } from "../api";
import type { Mode } from "../api";
import { messageOf, useAsync } from "../hooks/useAsync";

const MODES: { value: Mode; title: string; description: string }[] = [
  {
    value: "simulation",
    title: "Simulation",
    description: "Talk freely. At the end you get a full report on the whole conversation.",
  },
  {
    value: "guided",
    title: "Guided practice",
    description:
      "Draft each reply, get feedback, revise it, then send. The AI character replies only after you accept.",
  },
];

export function ScenarioPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const scenario = useAsync(() => getScenario(id), id);

  const [mode, setMode] = useState<Mode>("simulation");
  const [maxTurns, setMaxTurns] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (scenario.loading) return <Spinner />;
  if (scenario.error || !scenario.data) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to="/">All scenarios</BackLink>
        <Alert>{scenario.error ?? "Scenario not found"}</Alert>
      </div>
    );
  }

  const { title, config, editable } = scenario.data;

  const start = async (event: FormEvent) => {
    event.preventDefault();
    setStarting(true);
    setError(null);

    try {
      const thread = await startThread(id, mode, maxTurns ? Number(maxTurns) : null);
      navigate(`/threads/${thread.id}`);
    } catch (err) {
      setError(messageOf(err));
      setStarting(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <BackLink to="/">All scenarios</BackLink>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ScenarioBadge scenario={scenario.data} />
            {editable && (
              <div className="flex items-center gap-5">
                <Link to={`/scenarios/${id}/edit`} className={buttonClasses("text", "text-sm")}>
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="cursor-pointer text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-error hover:underline"
                >
                  Delete scenario
                </button>
              </div>
            )}
          </div>
          <h1 className="text-5xl leading-tight">{title}</h1>
        </div>

        {confirmingDelete && (
          <ConfirmDialog
            title="Delete this scenario?"
            text="This permanently removes the scenario, every conversation started from it, and their reports. This cannot be undone."
            confirmLabel="Yes, delete"
          pendingLabel="Deleting…"
            onConfirm={async () => {
              await deleteScenario(id);
              navigate("/");
            }}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}

        <Card>
          <dl className="flex flex-col gap-6">
            {config.context && <Detail label="Situation" text={config.context} />}
            {config.user_role && <Detail label="You are" text={config.user_role} />}
            {config.persona && <Detail label="AI Character" text={config.persona} />}
            {config.objectives && config.objectives.length > 0 && (
              <ListDetail label="Objectives" items={config.objectives} />
            )}
            {config.stopping_conditions && config.stopping_conditions.length > 0 && (
              <ListDetail label="Ends when" items={config.stopping_conditions} />
            )}
          </dl>
        </Card>
      </div>

      <form onSubmit={start} className="flex flex-col gap-6 self-start rounded-lg bg-card p-6 sm:p-8">
        <h2 className="text-2xl">Start a conversation</h2>

        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Mode</legend>
          {MODES.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-md border bg-canvas p-4 transition-colors hover:border-muted-soft hover:bg-card ${
                mode === option.value ? "border-primary" : "border-hairline"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="mt-1 accent-primary"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">{option.title}</span>
                <span className="text-sm leading-relaxed text-muted">{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <Field label="Turn limit" hint="Optional. Your replies in this conversation, from 1 to 50. Leave empty for the default.">
          {(fieldId) => (
            <TextInput
              id={fieldId}
              type="number"
              min={1}
              max={50}
              placeholder="Default"
              value={maxTurns}
              onChange={(e) => setMaxTurns(e.target.value)}
            />
          )}
        </Field>

        {error && <Alert>{error}</Alert>}

        <Button type="submit" disabled={starting} className="h-12 text-base">
          {starting ? "Starting…" : "Start conversation"}
        </Button>
      </form>
    </div>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-xs font-medium uppercase tracking-widest text-muted">{label}</dt>
      <dd className="text-base leading-relaxed text-body">{text}</dd>
    </div>
  );
}

function ListDetail({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-xs font-medium uppercase tracking-widest text-muted">{label}</dt>
      <dd>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-relaxed text-body">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}
