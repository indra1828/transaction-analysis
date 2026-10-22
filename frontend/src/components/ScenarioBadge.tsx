import type { Scenario } from "../api";
import { Badge } from "./Badge";

// Where a scenario comes from, as the person looking at it sees it.
export function ScenarioBadge({ scenario }: { scenario: Scenario }) {
  if (scenario.is_public) {
    return <Badge tone="neutral">Built-in</Badge>;
  }

  if (scenario.editable) {
    return scenario.is_shared ? <Badge tone="primary">Global</Badge> : <Badge tone="warning">Private</Badge>;
  }

  return <Badge tone="success">Assigned</Badge>;
}
