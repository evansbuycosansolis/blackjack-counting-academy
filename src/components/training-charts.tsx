"use client";
import { evaluate } from "@/engine/cards";
import { useGame } from "@/stores/game-store";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Metric } from "./metric";
interface Datum {
  label: string;
  value: number;
}
function Plot({
  title,
  description,
  data,
  line = false,
}: {
  title: string;
  description: string;
  data: Datum[];
  line?: boolean;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>{description}</p>
      {data.length ? (
        <div className="chart">
          <ResponsiveContainer>
            {line ? (
              <LineChart data={data}>
                <CartesianGrid stroke="#ffffff0b" vertical={false} />
                <XAxis dataKey="label" stroke="#7f9187" />
                <YAxis stroke="#7f9187" />
                <Tooltip
                  contentStyle={{
                    background: "#18201c",
                    border: "1px solid #46503d",
                  }}
                />
                <Line
                  dataKey="value"
                  stroke="#b6ce8a"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid stroke="#ffffff0b" vertical={false} />
                <XAxis dataKey="label" stroke="#7f9187" />
                <YAxis stroke="#7f9187" />
                <Tooltip
                  contentStyle={{
                    background: "#18201c",
                    border: "1px solid #46503d",
                  }}
                />
                <Bar dataKey="value" fill="#b6ce8a" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-state">
          <p>Complete relevant practice to collect these measurements.</p>
        </div>
      )}
    </section>
  );
}
export function TrainingCharts() {
  const s = useGame(),
    countChecks = s.checks.filter((x) => x.kind === "counting"),
    tcChecks = countChecks.filter((x) => x.error !== undefined),
    decisions = s.history.flatMap((r) => r.decisions),
    indices = decisions.filter(
      (d) => d.countRecommended && d.countRecommended !== d.recommended,
    );
  let correct = 0;
  const accuracy = countChecks.map((c, i) => {
    correct += Number(c.correct);
    return {
      label: String(i + 1),
      value: Math.round((correct / (i + 1)) * 100),
    };
  });
  const mistakes = ["Hard", "Soft", "Pair"].map((label) => ({
    label,
    value: decisions.filter(
      (d) =>
        d.recommended &&
        d.action !== d.recommended &&
        (d.cards.length === 2 && d.cards[0].rank === d.cards[1].rank
          ? "Pair"
          : evaluate(d.cards).soft
            ? "Soft"
            : "Hard") === label,
    ).length,
  }));
  const wagers = [...new Set(s.history.map((r) => r.wager))]
    .sort((a, b) => a - b)
    .map((n) => ({
      label: String(n / 100),
      value: s.history.filter((r) => r.wager === n).length,
    }));
  const sessions = [...new Set(s.history.map((r) => r.session))].map(
    (id, i) => ({
      label: String(i + 1),
      value: s.history
        .filter((r) => r.session === id)
        .reduce((n, r) => n + r.profit / 100, 0),
    }),
  );
  const results = s.history.flatMap((r) => r.results),
    breakdown = ["Win", "Loss", "Bust", "Push", "Blackjack", "Surrender"].map(
      (label) => ({ label, value: results.filter((r) => r === label).length }),
    );
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="COUNTING ACCURACY"
          value={
            countChecks.length
              ? `${((countChecks.filter((c) => c.correct).length / countChecks.length) * 100).toFixed(1)}%`
              : "—"
          }
          detail={`${countChecks.length} count checkpoints`}
        />
        <Metric
          label="TRUE COUNT ERROR"
          value={
            tcChecks.length
              ? (
                  tcChecks.reduce((n, c) => n + c.error!, 0) / tcChecks.length
                ).toFixed(2)
              : "—"
          }
          detail="Mean absolute index error"
        />
        <Metric
          label="DEVIATION ACCURACY"
          value={
            indices.length
              ? `${((indices.filter((d) => d.action === d.countRecommended).length / indices.length) * 100).toFixed(1)}%`
              : "—"
          }
          detail={`${indices.length} departures from basic strategy`}
        />
        <Metric
          label="ACADEMY PROGRESS"
          value={`${s.completed.length}/7`}
          detail={
            s.completed.length === 7
              ? "Foundations achievement earned"
              : "Complete lessons to earn your badge"
          }
        />
      </div>
      <div className="metric-grid">
        {(() => {
          const bets = s.history.map((r) => r.betAssessment).filter((x) => !!x);
          return (
            <Metric
              label="BETTING DISCIPLINE"
              value={
                bets.length
                  ? (
                      (bets.filter((b) => b.correct).length / bets.length) *
                      100
                    ).toFixed(1) + "%"
                  : "—"
              }
              detail={
                bets.length +
                " wagers compared with their declared betting exercise"
              }
            />
          );
        })()}
      </div>
      <div className="two-columns">
        <Plot
          title="Counting accuracy over time"
          description="Cumulative checkpoint accuracy, percent."
          data={accuracy}
          line
        />
        <Plot
          title="True-count estimation error"
          description="Absolute index error at each submitted true-count checkpoint."
          data={tcChecks.map((c, i) => ({
            label: String(i + 1),
            value: c.error!,
          }))}
          line
        />
        <Plot
          title="Strategy mistakes by hand category"
          description="Live-table choices compared with supported basic strategy."
          data={decisions.length ? mistakes : []}
        />
        <Plot
          title="Wager distribution"
          description="Total chips committed per round, including splits and insurance."
          data={wagers}
        />
        <Plot
          title="Hand outcome breakdown"
          description="Settled main hands; insurance profit is included in bankroll results."
          data={results.length ? breakdown : []}
        />
        <Plot
          title="Session performance trends"
          description="Net virtual profit in each saved session."
          data={sessions}
        />
      </div>
    </>
  );
}
