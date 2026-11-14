"use client";
import { BettingMode, defaultRamp, validateRamp } from "@/engine/betting";
import { rulesKey } from "@/engine/calibration";
import { selectProfile, indexPolicyKey } from "@/engine/index-profiles";
import { ruleSummary } from "@/engine/rules";
import { SimulationConfig, SimulationResult } from "@/engine/simulation";
import {
  deviationsSupported,
  strategyScope,
  strategySupported,
} from "@/engine/strategy";
import { download, summarize, RoundRecord } from "@/lib/analytics";
import { allRoundRecords } from "@/lib/storage";
import { money, signed } from "@/lib/format";
import { useGame } from "@/stores/game-store";
import { useLab } from "@/stores/lab-store";
import {
  ArrowDownToLine,
  ChevronRight,
  GraduationCap,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BettingTools } from "./betting-tools";
import { Metric } from "./metric";
import { RiskLaboratory } from "./risk-laboratory";
import { Button } from "./ui/button";

import { RoundReplay } from "./round-replay";
import { TrainingCharts } from "./training-charts";

const chartStyle = {
  background: "#162220",
  border: "1px solid #34443d",
  borderRadius: 8,
  color: "#e9eee9",
  fontSize: 12,
};
export function BankrollChart({
  data,
}: {
  data: { hand: number; bankroll: number }[];
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b6ce8a" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#b6ce8a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ffffff0b" vertical={false} />
          <XAxis
            dataKey="hand"
            stroke="#7f9187"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#7f9187"
            tickLine={false}
            axisLine={false}
            width={65}
          />
          <Tooltip contentStyle={chartStyle} />
          <Area
            name="Virtual bankroll"
            type="monotone"
            dataKey="bankroll"
            stroke="#b6ce8a"
            fill="url(#bankrollFill)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Analytics() {
  const s = useGame(),
    [archived, setArchived] = useState<RoundRecord[] | null>(null),
    history = archived ?? s.history,
    stats = summarize(history),
    [session, setSession] = useState("all"),
    [review, setReview] = useState<string | null>(null);
  const sessions = [...new Set(history.map((r) => r.session))],
    records =
      session === "all"
        ? history
        : history.filter((r) => r.session === session),
    a = summarize(records),
    decision = records.find((r) => r.id === review);
  const stride = Math.max(1, Math.ceil(records.length / 1000));
  const points = records
    .map((r, i) => ({
      hand: i + 1,
      bankroll: r.bankroll / 100,
    }))
    .filter((_, i) => i % stride === 0 || i === records.length - 1);
  const byCount = [...new Set(records.map((r) => r.tc))]
    .sort((a, b) => a - b)
    .map((tc) => ({
      tc,
      profit: records
        .filter((r) => r.tc === tc)
        .reduce((sum, r) => sum + r.profit / 100, 0),
    }));
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="TOTAL HANDS"
          value={String(stats.hands)}
          detail={`${stats.sessions} sessions saved`}
        />
        <Metric
          label="STRATEGY ACCURACY"
          value={
            stats.accuracy === null
              ? "—"
              : `${(stats.accuracy * 100).toFixed(1)}%`
          }
          detail={`${stats.decisionCount} supported decisions`}
        />
        <Metric
          label="OBSERVED PROFIT / LOSS"
          value={signed(stats.profit)}
          detail={`${(stats.roi * 100).toFixed(2)}% return on total wagered`}
        />
        <Metric
          label="MAXIMUM DRAWDOWN"
          value={money(a.drawdown)}
          detail="Maximum within a saved session"
        />
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Your progress, in perspective.</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void allRoundRecords().then(setArchived)}
            >
              Load complete IndexedDB history
            </Button>
            <p>
              Actual gameplay only. Split hands count individually; chart points
              are rounds.
            </p>
          </div>
          <div className="form-row">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  {
                    rounds: history,
                    checkpoints: s.checks,
                    completedLessons: s.completed,
                    rules: s.rules,
                  },
                  "blackjack-history.json",
                )
              }
            >
              <ArrowDownToLine size={14} /> JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  "date,session,round,bankroll,profit,wager,true_count,results\n" +
                    history
                      .map((r) =>
                        [
                          r.date,
                          r.session,
                          r.round,
                          r.bankroll / 100,
                          r.profit / 100,
                          r.wager / 100,
                          r.tc,
                          r.results.join("|"),
                        ].join(","),
                      )
                      .join("\n"),
                  "blackjack-history.csv",
                  true,
                )
              }
            >
              CSV
            </Button>
          </div>
        </div>
        <label className="compact-label">
          Review session
          <select value={session} onChange={(e) => setSession(e.target.value)}>
            <option value="all">All saved sessions</option>
            {sessions.map((id, i) => (
              <option key={id} value={id}>
                Session {i + 1} ·{" "}
                {new Date(
                  history.find((r) => r.session === id)!.date,
                ).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
        {records.length ? (
          <BankrollChart data={points} />
        ) : (
          <div className="empty-state">
            <GraduationCap />
            <h3>Your story starts at the table.</h3>
            <p>
              Complete a blackjack round to see your bankroll chart and decision
              history.
            </p>
            <a href="#play">Play your first hand →</a>
          </div>
        )}
        <div className="stat-strip">
          <span>
            Wins <b>{a.wins}</b>
          </span>
          <span>
            Losses / surrender <b>{a.losses}</b>
          </span>
          <span>
            Pushes <b>{a.pushes}</b>
          </span>
          <span>
            Blackjacks <b>{a.blackjacks}</b>
          </span>
          <span>
            Amount wagered <b>{money(a.wager)}</b>
          </span>
        </div>
      </section>
      {records.length > 0 && (
        <div className="two-columns">
          <section className="panel">
            <h2>Profit / loss by wager count</h2>
            <p>True count at initial wager placement.</p>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={byCount}>
                  <CartesianGrid stroke="#ffffff0b" vertical={false} />
                  <XAxis dataKey="tc" stroke="#7f9187" />
                  <YAxis stroke="#7f9187" />
                  <Tooltip contentStyle={chartStyle} />
                  <Bar dataKey="profit" fill="#b6ce8a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel">
            <h2>Decision review</h2>
            <p>Revisit the situation and your original choice.</p>
            <div className="scroll-list">
              {records
                .slice(-30)
                .reverse()
                .map((r) => (
                  <button
                    className="history-row"
                    key={r.id}
                    onClick={() => setReview(review === r.id ? null : r.id)}
                  >
                    <span>
                      Round {r.round}
                      <small>{new Date(r.date).toLocaleString()}</small>
                    </span>
                    <b className={r.profit >= 0 ? "green-text" : "red-text"}>
                      {signed(r.profit)}
                    </b>
                    <ChevronRight size={14} />
                  </button>
                ))}
            </div>
            {decision && (
              <div className="notice">
                <strong>{ruleSummary(decision.rules)}</strong>
                <p>
                  Session elapsed: {Math.round(decision.duration / 60000)} min ·
                  outcomes: {decision.results.join(", ")}
                </p>
                {decision.decisions.map((d, i) => (
                  <p key={i}>
                    {d.cards.map((c) => c.rank).join(" + ")} vs {d.dealer.rank}{" "}
                    · TC {d.count}: you chose <b>{d.action}</b>; basic strategy{" "}
                    <b>{d.recommended ?? "unsupported"}</b>.
                  </p>
                ))}
                {decision.betAssessment && (
                  <p>
                    Wager exercise: {decision.betAssessment.method} · TC{" "}
                    {decision.betAssessment.tc} · suggested{" "}
                    {money(decision.betAssessment.recommended * 100)}, actual{" "}
                    {money(decision.betAssessment.actual * 100)} ·{" "}
                    {decision.betAssessment.correct
                      ? "followed recommendation"
                      : "different wager"}
                    .
                  </p>
                )}
                <RoundReplay id={decision.id} />
                {decision.decisions.length === 0 && (
                  <p>Automatic settlement: no player decisions.</p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      <TrainingCharts />
    </>
  );
}
export function BettingLab() {
  const s = useGame(),
    lab = useLab(),
    [mode, setMode] = useState<BettingMode>("flat"),
    [hands, setHands] = useState(10000),
    [seed, setSeed] = useState(42),
    [bankroll, setBankroll] = useState(10000),
    [unit, setUnit] = useState(10),
    [kelly, setKelly] = useState(0.25),
    [withDeviations, setWithDeviations] = useState(false),
    [stopLoss, setStopLoss] = useState(0),
    [stopWin, setStopWin] = useState(0),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [result, setResult] = useState<SimulationResult | null>(null),
    [previous, setPrevious] = useState<SimulationResult[]>(
      lab.runs.slice(-5).map((r) => r.result),
    ),
    [chart, setChart] = useState("bankroll");
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const run = () => {
    setError("");
    if (
      !validateRamp(s.ramp) ||
      unit < 1 ||
      bankroll < s.rules.min ||
      !Number.isInteger(seed)
    ) {
      setError("Check ramp thresholds, unit, seed and bankroll.");
      return;
    }
    try {
      worker.current?.terminate();
      const w = new Worker(
        new URL("../workers/simulation.worker.ts", import.meta.url),
      );
      worker.current = w;
      setBusy(true);
      setProgress(0);
      const config: SimulationConfig = {
        rules: s.rules,
        edgeModel: lab.models.find(
          (m) =>
            m.rulesKey === rulesKey(s.rules) &&
            m.policy ===
              (withDeviations
                ? indexPolicyKey(
                    selectProfile(s.rules, s.activeIndexId, s.indexProfiles),
                  )
                : "basic"),
        ),
        indexProfile: selectProfile(s.rules, s.activeIndexId, s.indexProfiles),
        hands,
        seed,
        bankroll,
        mode,
        unit,
        ramp: s.ramp,
        kelly,
        deviations: withDeviations,
        stopLoss,
        stopWin,
      };
      w.onmessage = (e) => {
        if (e.data.type === "progress") setProgress(e.data.hands);
        if (e.data.type === "done") {
          setResult(e.data.result);
          lab.saveRun(e.data.result);
          setPrevious((p) => [...p, e.data.result].slice(-5));
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
        w.terminate();
      };
      w.postMessage({ type: "start", config });
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <BettingTools />
      <div className="two-columns lab-columns">
        <section className="panel">
          <div className="eyebrow gold">VIRTUAL BANKROLL LAB</div>
          <h2>Test a strategy. See the variance.</h2>
          <p>
            Seeded simulations use the same persistent-shoe engine as the
            practice table. Rules: {ruleSummary(s.rules)}.
          </p>
          {!strategySupported(s.rules) && (
            <div className="notice">
              Automated strategy is unavailable for these rules. {strategyScope}
            </div>
          )}
          <div className="form-grid">
            <label>
              Betting method
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as BettingMode)}
              >
                <option value="flat">Flat betting</option>
                <option value="ramp">Saved count ramp</option>
                <option value="kelly">
                  Fractional Kelly (calibrated outcomes)
                </option>
              </select>
            </label>
            <label>
              Rounds
              <select
                value={hands}
                onChange={(e) => setHands(Number(e.target.value))}
              >
                {[1000, 10000, 100000, 1000000].map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Initial virtual bankroll
              <input
                type="number"
                value={bankroll}
                min={s.rules.min}
                step={1}
                onChange={(e) => setBankroll(Number(e.target.value))}
              />
            </label>
            <label>
              Betting unit
              <input
                type="number"
                value={unit}
                min={1}
                step={1}
                onChange={(e) => setUnit(Number(e.target.value))}
              />
            </label>
            <label>
              Random seed
              <input
                type="number"
                value={seed}
                step={1}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </label>
            <label>
              Kelly fraction
              <select
                value={kelly}
                onChange={(e) => setKelly(Number(e.target.value))}
              >
                <option value={0.125}>⅛ Kelly</option>
                <option value={0.25}>¼ Kelly</option>
                <option value={0.5}>½ Kelly</option>
                <option value={1}>Full Kelly</option>
              </select>
            </label>
            <label>
              Stop-loss (0 = off)
              <input
                type="number"
                min={0}
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
              />
            </label>
            <label>
              Stop-win (0 = off)
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
              checked={withDeviations}
              disabled={!deviationsSupported(s.rules)}
              onChange={(e) => setWithDeviations(e.target.checked)}
            />{" "}
            Use supported I18 + Fab 4 deviations
          </label>
          <div className="form-row spaced">
            <Button
              disabled={busy || !strategySupported(s.rules)}
              onClick={run}
            >
              <Play size={16} /> Run simulation
            </Button>
            {busy && (
              <Button
                variant="outline"
                onClick={() => worker.current?.postMessage({ type: "cancel" })}
              >
                <Square size={14} /> Cancel
              </Button>
            )}
          </div>
          {busy && (
            <>
              <div className="progress-track">
                <i style={{ width: `${(progress / hands) * 100}%` }} />
              </div>
              <p role="status">
                {progress.toLocaleString()} / {hands.toLocaleString()} rounds ·{" "}
                {((progress / hands) * 100).toFixed(0)}%
              </p>
            </>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow gold">YOUR COUNT-BASED BETTING RAMP</div>
              <h2>Set your spread.</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => s.setRamp(defaultRamp)}
            >
              Reset
            </Button>
          </div>
          <p>
            First matching upper bound; the last row also applies above its
            threshold. Saved automatically in this browser.
          </p>
          <table>
            <thead>
              <tr>
                <th>TRUE COUNT ≤</th>
                <th>VIRTUAL CHIPS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.ramp.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input
                      aria-label={`Count threshold ${i + 1}`}
                      type="number"
                      value={r.tc}
                      onChange={(e) =>
                        s.setRamp(
                          s.ramp.map((x, j) =>
                            i === j ? { ...x, tc: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Ramp bet ${i + 1}`}
                      type="number"
                      min={1}
                      step={1}
                      value={r.bet}
                      onChange={(e) =>
                        s.setRamp(
                          s.ramp.map((x, j) =>
                            i === j ? { ...x, bet: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      aria-label={`Delete ramp row ${i + 1}`}
                      className="icon-btn"
                      disabled={s.ramp.length <= 1}
                      onClick={() =>
                        s.setRamp(s.ramp.filter((_, j) => i !== j))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              s.setRamp([
                ...s.ramp,
                {
                  tc: (s.ramp.at(-1)?.tc ?? 0) + 1,
                  bet: (s.ramp.at(-1)?.bet ?? 10) + 10,
                },
              ])
            }
          >
            <Plus size={14} /> Add threshold
          </Button>
          {!validateRamp(s.ramp) && (
            <p className="error">
              Thresholds must increase; wagers must be positive whole chips.
            </p>
          )}
          <div className="notice">
            <b>Statistical assumptions</b>
            <p>
              Kelly uses measured return distributions from a matching flat-bet
              calibration, rather than a generic count-to-edge formula. Each bin
              maximizes empirical log growth. Sparse bins use a fixed betting
              unit. Use the independent-session study for empirical ruin,
              survival and bankroll distributions; positive counts do not
              guarantee wins.
            </p>
          </div>
        </section>
      </div>
      {result && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Simulation results</h2>
              <p>
                {result.reason} · {result.hands.toLocaleString()} rounds · seed{" "}
                {result.seed} · {result.config.mode} ·{" "}
                {ruleSummary(result.config.rules)}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => download(result, "blackjack-simulation.json")}
            >
              <ArrowDownToLine size={14} /> Export
            </Button>
          </div>
          <div className="metric-grid">
            <Metric
              label="OBSERVED PROFIT / LOSS"
              value={money(result.profit * 100)}
              detail={`${((result.profit / Math.max(1, result.wagered)) * 100).toFixed(2)}% return on total wagers`}
            />
            <Metric
              label="MAX DRAWDOWN"
              value={money(result.maxDrawdown * 100)}
              detail={`Round P/L standard deviation: ${result.volatility.toFixed(2)}`}
            />
            <Metric
              label="AVERAGE INITIAL BET"
              value={money(result.averageBet * 100)}
              detail={`Maximum initial bet ${money(result.maxBet * 100)}`}
            />
            <Metric
              label="MEAN P/L · 95% INTERVAL"
              value={
                result.ci95.every(Number.isFinite)
                  ? `${result.ci95[0].toFixed(2)} to ${result.ci95[1].toFixed(2)}`
                  : "Insufficient shoes"
              }
              detail={`Chips / round · ${result.shoeClusters ?? 0} shoe clusters`}
            />
          </div>
          <div className="segmented">
            <span className="micro">
              {result.settledHands ?? "—"} main hands · win rate{" "}
              {(
                (result.wins /
                  Math.max(
                    1,
                    (result.settledHands ?? result.hands) - (result.voids ?? 0),
                  )) *
                100
              ).toFixed(2)}
              % · push rate{" "}
              {(
                (result.pushes /
                  Math.max(
                    1,
                    (result.settledHands ?? result.hands) - (result.voids ?? 0),
                  )) *
                100
              ).toFixed(2)}
              % · naturals per round{" "}
              {((result.blackjacks / Math.max(1, result.hands)) * 100).toFixed(
                2,
              )}
              % · {result.voids ?? 0} voids
            </span>
            {["bankroll", "drawdown", "by count", "outcomes"].map((x) => (
              <button
                key={x}
                className={chart === x ? "selected" : ""}
                onClick={() => setChart(x)}
              >
                {x}
              </button>
            ))}
          </div>
          {chart === "bankroll" ? (
            <BankrollChart data={result.points} />
          ) : (
            <div className="chart">
              <ResponsiveContainer>
                <BarChart
                  data={
                    chart === "drawdown"
                      ? result.points.map((x) => ({
                          ...x,
                          tc: 0,
                          range: "",
                          hands: 0,
                        }))
                      : chart === "by count"
                        ? result.byCount.map((x) => ({
                            ...x,
                            hand: 0,
                            bankroll: 0,
                            drawdown: 0,
                            range: "",
                          }))
                        : result.histogram.map((x) => ({
                            ...x,
                            hand: 0,
                            bankroll: 0,
                            drawdown: 0,
                            profit: 0,
                            tc: 0,
                          }))
                  }
                >
                  <CartesianGrid stroke="#ffffff0b" vertical={false} />
                  <XAxis
                    dataKey={
                      chart === "drawdown"
                        ? "hand"
                        : chart === "by count"
                          ? "tc"
                          : "range"
                    }
                    stroke="#7f9187"
                  />
                  <YAxis stroke="#7f9187" />
                  <Tooltip contentStyle={chartStyle} />
                  <Bar
                    dataKey={
                      chart === "drawdown"
                        ? "drawdown"
                        : chart === "by count"
                          ? "profit"
                          : "hands"
                    }
                    fill="#b6ce8a"
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="micro">
            Outcome distribution bins are round profit rounded to betting units.
            Confidence intervals use shoe-cluster variance; optional stopping
            and bankroll-dependent wagers limit their interpretation. Simulation
            records are separate from your training history.
          </p>
        </section>
      )}
      {previous.length > 0 && (
        <section className="panel">
          <h2>Compare recent runs</h2>
          <p>
            Same seed couples shuffle streams; different playing decisions
            change subsequent card allocation.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>METHOD</th>
                  <th>ROUNDS</th>
                  <th>SEED</th>
                  <th>DEVIATIONS</th>
                  <th>P/L</th>
                  <th>DRAWDOWN</th>
                  <th>AVG. TC</th>
                </tr>
              </thead>
              <tbody>
                {previous.map((r, i) => (
                  <tr key={i}>
                    <td>{r.config.mode}</td>
                    <td>{r.hands.toLocaleString()}</td>
                    <td>{r.seed}</td>
                    <td>{r.config.deviations ? "I18 + F4" : "Basic"}</td>
                    <td>{signed(r.profit * 100)}</td>
                    <td>{money(r.maxDrawdown * 100)}</td>
                    <td>{r.averageTC.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <RiskLaboratory />
    </>
  );
}
