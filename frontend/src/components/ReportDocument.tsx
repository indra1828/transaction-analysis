import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";

import type { EvaluationReport, ObjectiveResult } from "../api";
import { OBJECTIVE_LABEL, TRANSACTION_LABEL, formatDate } from "../lib/format";

export interface ReportPdfInput {
  scenarioTitle: string;
  date: string; // ISO date the conversation started
  report: EvaluationReport;
  // Returns the learner's exact words for a message id, if still in the conversation.
  quoteOf: (messageId: string) => string | undefined;
}

// The brand and text colours used in the report, matching the web app.
const COLOR = {
  primary: "#cc785c",
  ink: "#1f1c18",
  body: "#4a443d",
  muted: "#8a8178",
  hairline: "#e3ddd2",
  panel: "#f5f0e6",
  achieved: "#4f7d4f",
  partly: "#a7741f",
  missed: "#b04a3c",
};

const STATUS_COLOR: Record<ObjectiveResult["status"], string> = {
  achieved: COLOR.achieved,
  partly_achieved: COLOR.partly,
  missed: COLOR.missed,
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 52,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    color: COLOR.body,
  },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 11, color: COLOR.ink },
  brandAccent: { color: COLOR.primary },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: COLOR.muted,
    marginBottom: 6,
  },
  title: { fontFamily: "Helvetica-Bold", fontSize: 22, color: COLOR.ink, lineHeight: 1.2, marginBottom: 10 },
  summary: { fontSize: 11.5, lineHeight: 1.55, color: COLOR.ink, marginBottom: 4 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 10,
    marginBottom: 20,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.hairline,
  },
  section: { marginTop: 20 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: COLOR.ink,
    paddingBottom: 5,
    marginBottom: 10,
    borderBottomWidth: 0.75,
    borderBottomColor: COLOR.hairline,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.hairline,
  },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  rowTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, color: COLOR.ink, flex: 1 },
  status: { fontFamily: "Helvetica-Bold", fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.6 },
  muted: { fontSize: 9.5, color: COLOR.muted, marginTop: 3 },
  quoteBox: {
    borderLeftWidth: 2.5,
    borderLeftColor: COLOR.primary,
    backgroundColor: COLOR.panel,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  quote: { fontFamily: "Helvetica-Oblique", fontSize: 11.5, lineHeight: 1.45, color: COLOR.ink },
  label: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: COLOR.muted,
    marginBottom: 3,
  },
  labelAccent: { color: COLOR.primary },
  bullet: { flexDirection: "row", gap: 6, marginBottom: 5 },
  bulletDot: { color: COLOR.primary, width: 8 },
  bulletText: { flex: 1 },
  columns: { flexDirection: "row", gap: 24 },
  column: { flex: 1 },
  skillRow: { flexDirection: "row", gap: 14, paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: COLOR.hairline },
  skillName: { fontFamily: "Helvetica-Bold", width: 110, color: COLOR.ink },
  skillText: { flex: 1 },
  alternative: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.hairline,
  },
  suggestion: {
    backgroundColor: COLOR.panel,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    fontSize: 11,
    lineHeight: 1.45,
    color: COLOR.ink,
  },
  footnote: {
    marginTop: 26,
    paddingTop: 10,
    borderTopWidth: 0.75,
    borderTopColor: COLOR.hairline,
    fontFamily: "Helvetica-Oblique",
    fontSize: 8.5,
    color: COLOR.muted,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 52,
    right: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLOR.muted,
  },
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={60}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={index} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReportDocument({ scenarioTitle, date, report, quoteOf }: ReportPdfInput) {
  const counts = (["achieved", "partly_achieved", "missed"] as const).map((status) => ({
    status,
    count: report.objectives.filter((item) => item.status === status).length,
  }));
  const turningQuote = report.turning_point ? quoteOf(report.turning_point.message_id) : undefined;

  return (
    <Document title={`${scenarioTitle} · Practice report`} author="samvada.ai">
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>
            samvada<Text style={styles.brandAccent}>.ai</Text>
          </Text>
          <Text style={{ fontSize: 8, color: COLOR.muted }}>Practice report</Text>
        </View>

        <Text style={styles.eyebrow}>Report · {formatDate(date)}</Text>
        <Text style={styles.title}>{scenarioTitle}</Text>
        <Text style={styles.summary}>{report.summary}</Text>

        <Section title="Goals">
          <Text style={styles.muted}>
            {counts.map((item) => `${item.count} ${OBJECTIVE_LABEL[item.status].toLowerCase()}`).join("  ·  ")}
          </Text>
          <View style={{ marginTop: 6 }}>
            {report.objectives.map((item) => (
              <View key={item.objective} style={styles.row} wrap={false}>
                <View style={styles.rowHead}>
                  <Text style={styles.rowTitle}>{item.objective}</Text>
                  <Text style={{ ...styles.status, color: STATUS_COLOR[item.status] }}>
                    {OBJECTIVE_LABEL[item.status]}
                  </Text>
                </View>
                <Text style={styles.muted}>{item.evidence}</Text>
              </View>
            ))}
          </View>
        </Section>

        {report.turning_point && (
          <Section title="The turning point">
            {turningQuote && (
              <View style={styles.quoteBox} wrap={false}>
                <Text style={styles.quote}>“{turningQuote}”</Text>
              </View>
            )}
            <Text>{report.turning_point.explanation}</Text>
          </Section>
        )}

        {report.ego_state_cues.length > 0 && (
          <Section title="Ways of speaking">
            <Text style={styles.muted}>
              Each message can sound like a Parent, an Adult or a Child for a moment. These are readings of the words,
              not labels for the person.
            </Text>
            <View style={{ marginTop: 6 }}>
              {report.ego_state_cues.map((cue, index) => (
                <View key={index} style={styles.row} wrap={false}>
                  <Text style={{ ...styles.label, ...styles.labelAccent }}>
                    {cue.ego_state.charAt(0).toUpperCase() + cue.ego_state.slice(1)}
                  </Text>
                  <Text style={{ fontFamily: "Helvetica-Oblique", color: COLOR.ink }}>“{cue.evidence}”</Text>
                  <Text style={{ marginTop: 3 }}>{cue.note}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {report.transactions.length > 0 && (
          <Section title="How messages connected">
            {report.transactions.map((item, index) => (
              <View key={index} style={styles.row} wrap={false}>
                <Text style={styles.label}>{TRANSACTION_LABEL[item.kind]}</Text>
                <Text>{item.explanation}</Text>
              </View>
            ))}
          </Section>
        )}

        <Section title="Four skills">
          {[
            ["Assertiveness", report.assertiveness],
            ["Active listening", report.active_listening],
            ["Conflict management", report.conflict_management],
            ["Problem solving", report.problem_solving],
          ].map(([name, text]) => (
            <View key={name} style={styles.skillRow} wrap={false}>
              <Text style={styles.skillName}>{name}</Text>
              <Text style={styles.skillText}>{text}</Text>
            </View>
          ))}
        </Section>

        <Section title="What went well and what to work on">
          <View style={styles.columns}>
            <View style={styles.column}>
              <Text style={styles.label}>What went well</Text>
              <Bullets items={report.strengths} />
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Work on next</Text>
              <Bullets items={report.improvements} />
            </View>
          </View>
        </Section>

        {report.alternatives.length > 0 && (
          <Section title="Try instead">
            {report.alternatives.map((item, index) => {
              const said = quoteOf(item.message_id);

              return (
                <View key={index} style={styles.alternative} wrap={false}>
                  {said && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={styles.label}>You said</Text>
                      <Text style={{ fontFamily: "Helvetica-Oblique", color: COLOR.muted }}>“{said}”</Text>
                    </View>
                  )}
                  <Text style={{ ...styles.label, ...styles.labelAccent }}>Try this</Text>
                  <Text style={styles.suggestion}>“{item.suggested_response}”</Text>
                  <Text style={{ marginTop: 5 }}>{item.why}</Text>
                </View>
              );
            })}
          </Section>
        )}

        <Text style={styles.footnote}>{report.caveat}</Text>

        <View style={styles.footer} fixed>
          <Text>These are tentative observations from one practice conversation.</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

