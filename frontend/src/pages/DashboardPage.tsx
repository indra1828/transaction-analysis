import { Link } from "react-router";

import { Alert } from "../components/Alert";
import { Badge } from "../components/Badge";
import { ConversationRow } from "../components/ConversationRow";
import { buttonClasses } from "../components/buttonStyles";
import { PageHeader } from "../components/PageHeader";
import { Spinner } from "../components/Spinner";
import { listScenarios, listThreads } from "../api";
import type { Scenario } from "../api";
import { useAsync } from "../hooks/useAsync";

export function DashboardPage() {
  const scenarios = useAsync(listScenarios, "scenarios");
  const threads = useAsync(listThreads, "threads");

  const titles = new Map((scenarios.data ?? []).map((s) => [s.id, s.title]));

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Scenarios"
        description="Choose a scenario to rehearse with an AI character. Your conversations and reports are kept here."
        actions={
          <Link to="/scenarios/new" className={buttonClasses("secondary")}>
            New Scenario
          </Link>
        }
      />

      <section className="flex flex-col gap-6">
        <h2 className="text-3xl">Scenarios</h2>
        {scenarios.loading && <Spinner />}
        {scenarios.error && <Alert>{scenarios.error}</Alert>}
        {scenarios.data && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {scenarios.data.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-3xl">Your conversations</h2>
        {threads.loading && <Spinner />}
        {threads.error && <Alert>{threads.error}</Alert>}
        {threads.data && threads.data.length === 0 && (
          <p className="text-muted">No conversations yet. Start one from a scenario above.</p>
        )}
        {threads.data && threads.data.length > 0 && (
          <ul className="divide-y divide-hairline rounded-lg border border-hairline bg-canvas">
            {threads.data.map((thread) => (
              <ConversationRow
                key={thread.id}
                thread={thread}
                title={titles.get(thread.scenario_id)}
                onDeleted={() => void threads.reload()}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const description = scenario.config.context ?? scenario.config.persona ?? "";

  return (
    <Link
      to={`/scenarios/${scenario.id}`}
      className="flex flex-col gap-4 rounded-lg bg-card p-6 outline-none transition-colors hover:bg-cream-strong focus-visible:ring-3 focus-visible:ring-primary/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-2xl leading-snug">{scenario.title}</h3>
        <Badge tone={scenario.is_public ? "neutral" : "primary"}>
          {scenario.is_public ? "Built-in" : "Yours"}
        </Badge>
      </div>
      {description && <p className="line-clamp-3 text-sm leading-relaxed text-body">{description}</p>}
    </Link>
  );
}

