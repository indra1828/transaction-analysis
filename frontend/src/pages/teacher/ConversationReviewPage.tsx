import { useParams, useSearchParams } from "react-router";

import { Alert } from "../../components/Alert";
import { BackLink } from "../../components/BackLink";
import { Spinner } from "../../components/Spinner";
import { ViewToggle } from "../../components/ViewToggle";
import type { ViewChoice } from "../../components/ViewToggle";
import { getTeacherConversation } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { MODE_LABEL, STATUS_LABEL, formatDate } from "../../lib/format";
import { ReportView } from "../ReportPage";
import { Transcript } from "../thread/Transcript";

const noop = async () => {};

// One submitted conversation, read-only: its report, or its full transcript.
export function ConversationReviewPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const conversation = useAsync(() => getTeacherConversation(id), id);
  const view: ViewChoice = params.get("view") === "conversation" ? "conversation" : "report";

  if (conversation.loading) return <Spinner />;

  if (conversation.error || !conversation.data) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink to="/teacher">Dashboard</BackLink>
        <Alert>{conversation.error ?? "Conversation not found"}</Alert>
      </div>
    );
  }

  const item = conversation.data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-6">
        <BackLink to={`/teacher/scenarios/${item.scenario_id}`}>Back to submissions</BackLink>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl leading-tight">{item.learner_email}</h1>
          <p className="text-sm text-muted">
            {item.scenario_title} · {formatDate(item.created_at)} · {MODE_LABEL[item.mode]} ·{" "}
            {STATUS_LABEL[item.status]}
          </p>
        </div>
        <div>
          <ViewToggle value={view} onChange={(next) => setParams({ view: next }, { replace: true })} />
        </div>
      </div>

      {view === "report" ? (
        <ReportView scenarioTitle={item.scenario_title} date={item.created_at} messages={item.messages} report={item.report} />
      ) : (
        <div className="flex flex-col rounded-lg border border-hairline bg-canvas">
          <Transcript messages={item.messages} pending={null} canEdit={false} onEdit={noop} />
        </div>
      )}
    </div>
  );
}
