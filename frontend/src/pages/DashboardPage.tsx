import { Link } from "react-router";

import { useAuth } from "../auth/useAuth";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { ConversationRow } from "../components/ConversationRow";
import { buttonClasses } from "../components/buttonStyles";
import { PageHeader } from "../components/PageHeader";
import { ScenarioBadge } from "../components/ScenarioBadge";
import { Spinner } from "../components/Spinner";
import { listScenarios, listThreads } from "../api";
import type { Scenario } from "../api";
import { usePagedList } from "../hooks/usePagedList";
import { canTeach } from "../lib/roles";

export function DashboardPage() {
  const { user } = useAuth();
  const scenarios = usePagedList((offset, limit) => listScenarios({ offset, limit }), "scenarios");
  const threads = usePagedList((offset, limit) => listThreads({ offset, limit }), "threads");
  const teacher = user !== null && canTeach(user);

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Scenarios"
        description="Choose a scenario to rehearse with an AI character. Your conversations and reports are kept here."
        actions={
          teacher && (
            <Link to="/scenarios/new" className={buttonClasses("secondary")}>
              New Scenario
            </Link>
          )
        }
      />

      <section className="flex flex-col gap-6">
        <h2 className="text-3xl">Scenarios</h2>
        {scenarios.error && <Alert>{scenarios.error}</Alert>}
        {scenarios.items === null && !scenarios.error && <Spinner />}
        {scenarios.items && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {scenarios.items.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        )}
        {scenarios.hasMore && (
          <div>
            <Button variant="secondary" disabled={scenarios.loadingMore} onClick={() => void scenarios.loadMore()}>
              {scenarios.loadingMore ? "Loading…" : "Show more scenarios"}
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-3xl">Your conversations</h2>
        {threads.error && <Alert>{threads.error}</Alert>}
        {threads.items === null && !threads.error && <Spinner />}
        {threads.items && threads.items.length === 0 && (
          <p className="text-muted">No conversations yet. Start one from a scenario above.</p>
        )}
        {threads.items && threads.items.length > 0 && (
          <div className="flex flex-col gap-4">
            <ul className="divide-y divide-hairline rounded-lg border border-hairline bg-canvas">
              {threads.items.map((thread) => (
                <ConversationRow
                  key={thread.id}
                  thread={thread}
                  title={thread.scenario_title}
                  onDeleted={threads.reload}
                />
              ))}
            </ul>
            {threads.hasMore && (
              <div>
                <Button variant="secondary" disabled={threads.loadingMore} onClick={() => void threads.loadMore()}>
                  {threads.loadingMore ? "Loading…" : "Show more conversations"}
                </Button>
              </div>
            )}
          </div>
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
        <ScenarioBadge scenario={scenario} />
      </div>
      {description && <p className="line-clamp-3 text-sm leading-relaxed text-body">{description}</p>}
    </Link>
  );
}
