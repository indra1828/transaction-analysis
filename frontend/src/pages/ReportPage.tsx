import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";

import { Alert } from "../components/Alert";
import { Badge } from "../components/Badge";
import { BackLink } from "../components/BackLink";
import { Button } from "../components/Button";
import { buttonClasses } from "../components/buttonStyles";
import { SegmentBar } from "../components/SegmentBar";
import type { Segment } from "../components/SegmentBar";
import { Spinner } from "../components/Spinner";
import { ApiError, completeThread, getEvaluation, getScenario, getThread, listMessages } from "../api";
import type { Evaluation, EvaluationReport, Message, ObjectiveResult, Thread } from "../api";
import { messageOf, useAsync } from "../hooks/useAsync";
import { OBJECTIVE_LABEL, OBJECTIVE_TONE, TRANSACTION_LABEL, formatDate } from "../lib/format";

interface ReportData {
  thread: Thread;
  scenarioTitle: string;
  messages: Message[];
  evaluation: Evaluation | null;
}

// 404 means no report exists yet, which is a normal state for a thread that
// ended without one. Any other error is shown to the user.
function missingAsNull(error: unknown): null {
  if (error instanceof ApiError && error.status === 404) {
    return null;
  }

  throw error;
}

async function loadReport(id: string): Promise<ReportData> {
  const thread = await getThread(id);
  const [scenario, messages, evaluation] = await Promise.all([
    getScenario(thread.scenario_id).catch(() => null),
    listMessages(id),
    getEvaluation(id).catch(missingAsNull),
  ]);

  return {
    thread,
    scenarioTitle: scenario?.title ?? "Conversation",
    messages,
    evaluation,
  };
}

export function ReportPage() {
  const { id = "" } = useParams();
  const report = useAsync(() => loadReport(id), id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);

    try {
      await completeThread(id);
      await report.reload();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setGenerating(false);
    }
  };

  if (report.loading) {
    return <Spinner />;
  }

  if (!report.data) {
    return <Alert>{report.error ?? "Report not found"}</Alert>;
  }

  const { thread, scenarioTitle, messages, evaluation } = report.data;

  if (!evaluation) {
    const completed = thread.status === "completed";

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <BackLink to={`/threads/${id}`}>Back to conversation</BackLink>
        <h1 className="text-4xl">{scenarioTitle}</h1>
        <div className="flex flex-col gap-4 rounded-lg bg-card p-8">
          <h2 className="text-2xl">No report yet</h2>
          <p className="text-base leading-relaxed text-body">
            {completed
              ? "This conversation ended without a report. You can create one now from everything said so far."
              : "Finish the conversation first. The report reads the whole conversation."}
          </p>
          {error && <Alert>{error}</Alert>}
          {completed ? (
            <div>
              <Button disabled={generating} onClick={() => void generate()}>
                {generating ? "Creating report…" : "Create report"}
              </Button>
            </div>
          ) : (
            <Link to={`/threads/${id}`} className={buttonClasses("secondary", "self-start")}>
              Back to conversation
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <ReportView
      id={id}
      scenarioTitle={scenarioTitle}
      date={thread.created_at}
      messages={messages}
      report={evaluation.report}
    />
  );
}

const STATUS_COLOR: Record<ObjectiveResult["status"], string> = {
  achieved: "bg-success",
  partly_achieved: "bg-warning",
  missed: "bg-error",
};

const EGO_COLOR = {
  parent: "bg-primary",
  adult: "bg-teal",
  child: "bg-amber",
} as const;

function ReportView({
  id,
  scenarioTitle,
  date,
  messages,
  report,
}: {
  id: string;
  scenarioTitle: string;
  date: string;
  messages: Message[];
  report: EvaluationReport;
}) {
  const text = (messageId: string) => messages.find((m) => m.id === messageId)?.content;

  const objectiveSegments: Segment[] = (["achieved", "partly_achieved", "missed"] as const).map((status) => ({
    label: OBJECTIVE_LABEL[status],
    value: report.objectives.filter((item) => item.status === status).length,
    color: STATUS_COLOR[status],
  }));

  const egoSegments: Segment[] = (["parent", "adult", "child"] as const).map((state) => ({
    label: state.charAt(0).toUpperCase() + state.slice(1),
    value: report.ego_state_cues.filter((cue) => cue.ego_state === state).length,
    color: EGO_COLOR[state],
  }));

  // The PDF library loads only when the learner asks for the file.
  const download = async () => {
    const { downloadFile, reportFileName, reportToPdf } = await import("../lib/reportFile");

    downloadFile(reportFileName(scenarioTitle, date), reportToPdf({ scenarioTitle, date, report, quoteOf: text }));
  };

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-14">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BackLink to={`/threads/${id}`}>Back to conversation</BackLink>
          <Button variant="secondary" className="h-9 px-4 text-sm" onClick={() => void download()}>
            Download report
          </Button>
        </div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Report · {formatDate(date)}
        </p>
        <h1 className="text-5xl leading-tight">{scenarioTitle}</h1>
        <p className="text-xl leading-relaxed text-body-strong">{report.summary}</p>
      </header>

      <Section title="Goals">
        <SegmentBar label="Goal results" segments={objectiveSegments} />
        <ul className="flex flex-col divide-y divide-hairline">
          {report.objectives.map((item) => (
            <li key={item.objective} className="flex flex-col gap-2 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-lg text-ink">{item.objective}</span>
                <Badge tone={OBJECTIVE_TONE[item.status]}>{OBJECTIVE_LABEL[item.status]}</Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted">{item.evidence}</p>
            </li>
          ))}
        </ul>
      </Section>

      {report.turning_point && (
        <Section title="The turning point">
          <blockquote className="border-l-2 border-primary pl-6 text-2xl leading-snug text-ink">
            {text(report.turning_point.message_id) && <>“{text(report.turning_point.message_id)}”</>}
          </blockquote>
          <p className="text-base leading-relaxed text-body">{report.turning_point.explanation}</p>
        </Section>
      )}

      {report.ego_state_cues.length > 0 && (
        <Section title="Ways of speaking">
          <p className="text-sm leading-relaxed text-muted">
            Each message can sound like a Parent, an Adult or a Child for a moment. These are readings of the words, not labels for the person.
          </p>
          <SegmentBar label="How often each way of speaking appeared" segments={egoSegments} />
          <ul className="flex flex-col divide-y divide-hairline">
            {report.ego_state_cues.map((cue, index) => (
              <li key={index} className="flex flex-col gap-2 py-5">
                <Badge tone="neutral">{cue.ego_state.charAt(0).toUpperCase() + cue.ego_state.slice(1)}</Badge>
                <p className="font-display text-xl italic text-ink">“{cue.evidence}”</p>
                <p className="text-sm leading-relaxed text-body">{cue.note}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.transactions.length > 0 && (
        <Section title="How messages connected">
          <ul className="flex flex-col divide-y divide-hairline">
            {report.transactions.map((item, index) => (
              <li key={index} className="flex flex-col gap-2 py-5">
                <Badge>{TRANSACTION_LABEL[item.kind]}</Badge>
                <p className="text-base leading-relaxed text-body">{item.explanation}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Four skills">
        <dl className="flex flex-col divide-y divide-hairline">
          <SkillRow title="Assertiveness" text={report.assertiveness} />
          <SkillRow title="Active listening" text={report.active_listening} />
          <SkillRow title="Conflict management" text={report.conflict_management} />
          <SkillRow title="Problem solving" text={report.problem_solving} />
        </dl>
      </Section>

      <div className="grid gap-10 md:grid-cols-2">
        <Section title="What went well">
          <BulletList items={report.strengths} />
        </Section>
        <Section title="Work on next">
          <BulletList items={report.improvements} />
        </Section>
      </div>

      {report.alternatives.length > 0 && (
        <Section title="Try instead">
          <ul className="flex flex-col divide-y divide-hairline">
            {report.alternatives.map((item, index) => (
              <li key={index} className="flex flex-col gap-4 py-6">
                {text(item.message_id) && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-widest text-muted">You said</span>
                    <p className="text-base text-muted">“{text(item.message_id)}”</p>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-widest text-primary">Try this</span>
                  <p className="text-lg leading-relaxed text-ink">“{item.suggested_response}”</p>
                </div>
                <p className="text-sm leading-relaxed text-body">{item.why}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="border-t border-hairline pt-6 text-xs leading-relaxed text-muted-soft">{report.caveat}</p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function SkillRow({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 py-5 md:grid md:grid-cols-[200px_1fr] md:gap-8">
      <dt className="font-display text-xl text-ink">{title}</dt>
      <dd className="text-base leading-relaxed text-body">{text}</dd>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-3 pl-5 text-base leading-relaxed text-body">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
