import { Link } from "react-router";

import { Alert } from "../../components/Alert";
import { Button } from "../../components/Button";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { listTeacherScenarios } from "../../api";
import type { TeacherScenario } from "../../api";
import { usePagedList } from "../../hooks/usePagedList";

// One card per scenario. Opening a card shows the learners' submissions for it.
export function TeacherDashboardPage() {
  const cards = usePagedList((offset, limit) => listTeacherScenarios({ offset, limit }), "teacher-cards");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Dashboard" description="Choose a scenario to see the conversations learners submitted for it." />

      {cards.error && <Alert>{cards.error}</Alert>}
      {cards.items === null && !cards.error && <Spinner />}

      {cards.items?.length === 0 && <p className="text-muted">You have not created a scenario yet.</p>}

      {cards.items && cards.items.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cards.items.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      )}

      {cards.hasMore && (
        <div>
          <Button variant="secondary" disabled={cards.loadingMore} onClick={() => void cards.loadMore()}>
            {cards.loadingMore ? "Loading…" : "Show more scenarios"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: TeacherScenario }) {
  return (
    <Link
      to={`/teacher/scenarios/${scenario.id}`}
      className="flex min-h-28 items-center rounded-lg bg-card p-6 outline-none transition-colors hover:bg-cream-strong focus-visible:ring-3 focus-visible:ring-primary/30"
    >
      <h2 className="text-2xl leading-snug">{scenario.title}</h2>
    </Link>
  );
}
