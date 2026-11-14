"use client";
import { rulesKey } from "@/engine/calibration";
import { RiskConfig, RiskResult } from "@/engine/risk";
import { SimulationConfig } from "@/engine/simulation";
import { download } from "@/lib/analytics";
import { useGame } from "@/stores/game-store";
import { useLab } from "@/stores/lab-store";
import { useEffect, useRef, useState } from "react";
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
import { Button } from "./ui/button";
export function RiskLaboratory() {
  const s = useGame(),
    lab = useLab(),
    [sessions, setSessions] = useState(100),
    [horizon, setHorizon] = useState(1000),
    [bankroll, setBankroll] = useState(1000),
    [seed, setSeed] = useState(42),
    [unit, setUnit] = useState(10),
    [stopLoss, setStopLoss] = useState(0),
    [stopWin, setStopWin] = useState(0),
    [kelly, setKelly] = useState(0.25),
    [includeKelly, setIncludeKelly] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [result, setResult] = useState<RiskResult | null>(
      lab.riskRuns.at(-1)?.result ?? null,
    ),
    [selected, setSelected] = useState(0),
    [plot, setPlot] = useState("Final bankroll");
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const run = () => {
    try {
      if (
        !Number.isInteger(sessions) ||
        sessions < 2 ||
        !Number.isInteger(horizon) ||
        horizon < 1
      )
        throw Error(
          "Use at least two independent sessions and a positive integer horizon.",
        );
      const model = lab.models.find(
        (m) => m.rulesKey === rulesKey(s.rules) && m.policy === "basic",
      );
      if (includeKelly && !model)
        throw Error("Calibrate the selected rules before comparing Kelly.");
      const base: SimulationConfig = {
        rules: s.rules,
        hands: horizon,
        seed: 0,
        bankroll,
        mode: "flat",
        unit,
        ramp: s.ramp,
        kelly,
        deviations: false,
        stopLoss,
        stopWin,
        edgeModel: model,
      };
      const config: RiskConfig = {
        sessions,
        seed,
        strategies: [
          { name: "Flat betting", config: base },
          { name: "Count-based ramp", config: { ...base, mode: "ramp" } },
          ...(includeKelly
            ? [
                {
                  name: "Empirical fractional Kelly",
                  config: { ...base, mode: "kelly" as const },
                },
              ]
            : []),
        ],
      };
      worker.current?.terminate();
      const w = new Worker(
        new URL("../workers/risk.worker.ts", import.meta.url),
      );
      worker.current = w;
      setBusy(true);
      setError("");
      setProgress(0);
      w.onmessage = (e) => {
        if (e.data.type === "progress")
          setProgress(e.data.completed / e.data.total);
        if (e.data.type === "done") {
          setResult(e.data.result);
          lab.saveRisk(e.data.result);
          setSelected(0);
          setBusy(false);
          w.terminate();
        }
        if (e.data.type === "error") {
          setError(e.data.message);
          setBusy(false);
          w.terminate();
        }
      };
      w.onerror = (e) => {
        setError(e.message);
        setBusy(false);
      };
      w.postMessage({ type: "start", config });
    } catch (e) {
      setError(String(e));
    }
  };
  const summary = result?.summaries[selected];
  return (
    <section className="panel">
      <div className="eyebrow gold">INDEPENDENT SESSION RISK STUDY</div>
      <h2>Measure survival, not just one lucky path.</h2>
      <p>
        Each replication starts a new bankroll and shoe. Cards remain dependent
        within a session; uncertainty is calculated over whole independent
        sessions. Strategies are paired by seed for comparisons.
      </p>
      <div className="form-grid">
        <label>
          Independent sessions
          <input
            aria-label="Independent sessions"
            type="number"
            min={2}
            max={10000}
            value={sessions}
            onChange={(e) => setSessions(Number(e.target.value))}
          />
        </label>
        <label>
          Session horizon (rounds)
          <input
            aria-label="Session horizon"
            type="number"
            min={1}
            max={1000000}
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
          />
        </label>
        <label>
          Session bankroll
          <input
            aria-label="Risk study bankroll"
            type="number"
            min={1}
            value={bankroll}
            onChange={(e) => setBankroll(Number(e.target.value))}
          />
        </label>
        <label>
          Betting unit
          <input
            aria-label="Risk study unit"
            type="number"
            min={1}
            value={unit}
            onChange={(e) => setUnit(Number(e.target.value))}
          />
        </label>
        <label>
          Study seed
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <label>
          Kelly fraction
          <input
            type="number"
            min={0.01}
            max={1}
            step={0.05}
            value={kelly}
            onChange={(e) => setKelly(Number(e.target.value))}
          />
        </label>
        <label>
          Stop-loss (0 off)
          <input
            type="number"
            min={0}
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
          />
        </label>
        <label>
          Stop-win (0 off)
          <input
            type="number"
            min={0}
            value={stopWin}
            onChange={(e) => setStopWin(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={includeKelly}
          onChange={(e) => setIncludeKelly(e.target.checked)}
        />{" "}
        Include calibrated Kelly comparison
      </label>
      <div className="form-row">
        <Button disabled={busy} onClick={run}>
          Run independent sessions
        </Button>
        {busy && (
          <Button
            variant="outline"
            onClick={() => worker.current?.postMessage({ type: "cancel" })}
          >
            Cancel risk study
          </Button>
        )}
      </div>
      {busy && (
        <p role="status">
          Completed session/strategy replications: {(progress * 100).toFixed(1)}
          %
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && !result.summaries.some((r) => r.sessions > 0) && (
        <p role="status" className="notice">
          No independent sessions completed. Risk estimates are unavailable.
        </p>
      )}
      {result && summary && result.summaries.some((r) => r.sessions > 0) && (
        <>
          <div className="notice">
            <strong>
              {result.cancelled
                ? "Partial cancelled study"
                : "Completed independent-session study"}
            </strong>
            <p>{result.method}</p>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Sessions</th>
                  <th>Empirical ruin</th>
                  <th>95% ruin interval</th>
                  <th>Survival</th>
                  <th>Mean P/L · session-bootstrap 95% CI</th>
                </tr>
              </thead>
              <tbody>
                {result.summaries.map((r, i) =>
                  r.sessions === 0 ? (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td colSpan={5}>
                        No completed sessions; estimates unavailable.
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.name} onClick={() => setSelected(i)}>
                      <td>
                        <Button
                          variant={selected === i ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setSelected(i)}
                        >
                          {r.name}
                        </Button>
                      </td>
                      <td>{r.sessions}</td>
                      <td>{(r.ruinProbability * 100).toFixed(2)}%</td>
                      <td>
                        {(r.ruinCI[0] * 100).toFixed(2)}% to{" "}
                        {(r.ruinCI[1] * 100).toFixed(2)}%
                      </td>
                      <td>{(r.survivalProbability * 100).toFixed(2)}%</td>
                      <td>
                        {r.meanProfit.toFixed(2)} ·{" "}
                        {r.sessions > 1
                          ? `${r.profitCI[0].toFixed(2)} to ${r.profitCI[1].toFixed(2)}`
                          : "Insufficient replications"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <div className="segmented">
            {["Final bankroll", "Maximum drawdown", "Survival"].map((x) => (
              <button
                key={x}
                className={plot === x ? "selected" : ""}
                onClick={() => setPlot(x)}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="chart">
            <ResponsiveContainer>
              {plot === "Survival" ? (
                <LineChart data={summary.survival}>
                  <CartesianGrid stroke="#ffffff0b" />
                  <XAxis dataKey="round" stroke="#7f9187" />
                  <YAxis domain={[0, 1]} stroke="#7f9187" />
                  <Tooltip />
                  <Line dataKey="probability" stroke="#b6ce8a" dot={false} />
                </LineChart>
              ) : (
                <BarChart
                  data={
                    plot === "Final bankroll"
                      ? summary.finalDistribution
                      : summary.drawdownDistribution
                  }
                >
                  <XAxis dataKey="label" stroke="#7f9187" />
                  <YAxis stroke="#7f9187" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#b6ce8a" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <p className="micro">
            {summary.name} · mean max drawdown {summary.meanDrawdown.toFixed(2)}{" "}
            chips · median final bankroll {summary.medianBankroll.toFixed(2)} ·{" "}
            {summary.stopped} sessions stopped by thresholds. Quantiles:{" "}
            {summary.bankrollQuantiles
              .map((q) => `${Math.round(q.p * 100)}%: ${q.value.toFixed(2)}`)
              .join(" · ")}
            .
          </p>
          {result.comparisons.map((c) => (
            <p key={c.name}>
              {c.name}: mean paired profit difference{" "}
              {c.meanDifference.toFixed(2)};{" "}
              {c.pairs > 1
                ? `95% session-bootstrap interval ${c.ci[0].toFixed(2)} to ${c.ci[1].toFixed(2)}`
                : "Insufficient matched pairs"}{" "}
              ({c.pairs} pairs).
            </p>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              download(result, "blackjack-independent-sessions.json")
            }
          >
            Export risk study
          </Button>
        </>
      )}
    </section>
  );
}
