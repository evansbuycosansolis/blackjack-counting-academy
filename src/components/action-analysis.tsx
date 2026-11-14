"use client";
import { AnalysisResult, outcomeNames } from "@/engine/analysis";
import { download } from "@/lib/analytics";
import { useGame } from "@/stores/game-store";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
export function AnalysisLauncher() {
  const dialog = useRef<HTMLDialogElement>(null),
    [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        Analyze action EV
      </Button>
      <dialog
        ref={dialog}
        className="analysis-dialog"
        onClose={() => setOpen(false)}
      >
        <div className="panel-header">
          <h2>Composition-dependent action analysis</h2>
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            Close analysis
          </Button>
        </div>
        {open && <ActionAnalysis />}
      </dialog>
    </>
  );
}
export function ActionAnalysis() {
  const s = useGame(),
    g = s.game;
  const [samples, setSamples] = useState(10000),
    [result, setResult] = useState<AnalysisResult | null>(null),
    [validation, setValidation] = useState<AnalysisResult | null>(null),
    [curve, setCurve] = useState<
      {
        samples: number;
        action: string;
        mean: number;
        low: number;
        high: number;
      }[]
    >([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [cancelled, setCancelled] = useState(false);
  const worker = useRef<Worker | null>(null);
  const key = g
    ? `${g.shuffles}-${g.round}-${g.cursor}-${g.active}-${g.phase}`
    : "";
  useEffect(() => {
    worker.current?.terminate();
    setBusy(false);
    setResult(null);
    setValidation(null);
    setCurve([]);
    return () => worker.current?.terminate();
  }, [key]);
  const run = (validate = false) => {
    if (!g || s.casino) return;
    worker.current?.terminate();
    const w = new Worker(
      new URL("../workers/analysis.worker.ts", import.meta.url),
    );
    worker.current = w;
    setBusy(true);
    setError("");
    setCancelled(false);
    setProgress(0);
    w.onmessage = (e) => {
      if (e.data.type === "progress") setProgress(e.data.samples);
      if (e.data.type === "done") {
        if (validate) {
          setValidation(e.data.result);
          setCurve(e.data.curve ?? []);
        } else {
          setResult(e.data.result);
          setValidation(null);
        }
        setCancelled(!!e.data.cancelled);
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
    w.postMessage({
      type: "analyze",
      game: g,
      samples,
      seed: validate ? 20261112 : 42,
      compareExact: validate,
    });
  };
  if (s.casino)
    return (
      <p className="notice">
        Composition analysis is hidden in unaided casino mode. Switch to
        training view to study the mathematics.
      </p>
    );
  if (!g || g.phase !== "playing")
    return (
      <p className="notice">
        Deal a hand and leave a player decision active to analyze hit, stand,
        double, split and surrender under the selected rules.
      </p>
    );
  return (
    <>
      <p>
        Analysis uses exposed-card information and integrates the unknown hole
        card out. The actual hidden identity and shoe order are never used as
        known information. Exact enumeration is attempted first; costly trees
        use independent finite-shoe simulations.
      </p>
      <div className="form-row">
        <label>
          Monte Carlo trial limit
          <select
            aria-label="Analysis trials"
            value={samples}
            onChange={(e) => setSamples(Number(e.target.value))}
          >
            {[2000, 10000, 50000].map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString()} trials per action
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => run()} disabled={busy}>
          Calculate action values
        </Button>
        {busy && (
          <Button
            variant="outline"
            onClick={() => worker.current?.postMessage({ type: "cancel" })}
          >
            Cancel analysis
          </Button>
        )}
      </div>
      {busy && (
        <p role="status">
          Exact tree or simulation running… {progress.toLocaleString()}{" "}
          independent trial shoes
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="notice">
            <b>
              {result.method === "exact"
                ? "Exact finite-composition result"
                : "Monte Carlo policy evaluation"}
              {cancelled ? " · cancelled partial sample" : ""}
            </b>
            <p>
              {result.method === "exact"
                ? `Optimal legal action: ${result.recommended}. ${result.states.toLocaleString()} unique combinatorial states evaluated.`
                : `Highest sampled mean: ${result.recommended}. This evaluates the declared continuation policy; it is not a proof of globally optimal strategy.`}
            </p>
            <p>{result.assumptions}</p>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Net EV / initial round wager</th>
                  <th>95% interval</th>
                  <th>Independent trials</th>
                </tr>
              </thead>
              <tbody>
                {result.actions.map((x) => (
                  <tr key={x.action}>
                    <td>{x.action}</td>
                    <td>{x.ev.toFixed(5)}</td>
                    <td>
                      {result.method === "exact"
                        ? "Exact calculation"
                        : `${x.ci95[0].toFixed(5)} to ${x.ci95[1].toFixed(5)}`}
                    </td>
                    <td>{x.samples || "Enumeration"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Dealer outcome distribution</h3>
          <p className="micro">
            {result.dealerMethod === "exact"
              ? "Exact combinatorial calculation"
              : `${result.dealerSamples} samples`}{" "}
            · dealer draws from the current observable composition if the player
            stands without further draws.
          </p>
          <div className="stat-strip">
            {outcomeNames.map((name, i) => (
              <span key={name}>
                {name}
                <b>{(result.dealer[i] * 100).toFixed(3)}%</b>
              </span>
            ))}
          </div>
          <p>
            Insurance: {(result.insurance.probability * 100).toFixed(3)}% dealer
            blackjack probability; EV {result.insurance.ev.toFixed(5)} per
            insurance chip.{" "}
            {result.insurance.available
              ? "Currently offered."
              : "Not currently offered; a successful peek excludes a natural."}
          </p>
          <details>
            <summary>Observable remaining composition</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Value</th>
                    <th>Unknown physical cards</th>
                    <th>Pool fraction</th>
                  </tr>
                </thead>
                <tbody>
                  {result.composition.map((x) => (
                    <tr key={x.value}>
                      <td>{x.value === 11 ? "A" : x.value}</td>
                      <td>{x.cards}</td>
                      <td>{(x.probability * 100).toFixed(3)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <Button
            variant="outline"
            size="sm"
            onClick={() => download(result, "blackjack-action-analysis.json")}
          >
            Export analysis
          </Button>
          {result.method === "exact" && (
            <Button variant="outline" disabled={busy} onClick={() => run(true)}>
              Compare exact EV with independent trials
            </Button>
          )}
          {validation && result.method === "exact" && (
            <>
              <h3>Theoretical versus observed action EV</h3>
              <p>
                Every action, including hit and split, uses the same exact
                optimal future policy in both calculations. All split/double
                wagers and remaining hands are included, per original round
                wager. Intervals are pointwise 95% intervals; repeated looks at
                the curve are not a sequential significance test.
              </p>
              <div className="chart">
                <ResponsiveContainer>
                  <BarChart
                    data={result.actions.map((x) => ({
                      action: x.action,
                      exact: x.ev,
                      observed:
                        validation.actions.find((v) => v.action === x.action)
                          ?.ev ?? 0,
                    }))}
                  >
                    <XAxis dataKey="action" stroke="#7f9187" />
                    <YAxis stroke="#7f9187" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="exact" fill="#d5b876" />
                    <Bar dataKey="observed" fill="#b6ce8a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Exact EV</th>
                      <th>Observed mean</th>
                      <th>Observed 95% interval</th>
                      <th>Trials</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.actions.map((x) => {
                      const observed = validation.actions.find(
                        (v) => v.action === x.action,
                      )!;
                      return (
                        <tr key={x.action}>
                          <td>{x.action}</td>
                          <td>{x.ev.toFixed(5)}</td>
                          <td>{observed.ev.toFixed(5)}</td>
                          <td>
                            {observed.ci95[0].toFixed(5)} to{" "}
                            {observed.ci95[1].toFixed(5)}
                          </td>
                          <td>{observed.samples}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <h3>Simulation EV convergence curves</h3>
              {result.actions.map((x) => (
                <div key={x.action}>
                  <h4>
                    {x.action} · exact EV {x.ev.toFixed(5)}
                  </h4>
                  <div className="chart">
                    <ResponsiveContainer>
                      <LineChart
                        data={curve.filter((p) => p.action === x.action)}
                      >
                        <XAxis
                          dataKey="samples"
                          type="number"
                          stroke="#7f9187"
                        />
                        <YAxis stroke="#7f9187" domain={["auto", "auto"]} />
                        <Tooltip />
                        <Legend />
                        <ReferenceLine
                          y={x.ev}
                          stroke="#d5b876"
                          label="Exact"
                        />
                        <Line
                          dataKey="mean"
                          name="Observed mean"
                          stroke="#b6ce8a"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          dataKey="low"
                          name="95% lower"
                          stroke="#91b8c8"
                          strokeDasharray="4 4"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          dataKey="high"
                          name="95% upper"
                          stroke="#91b8c8"
                          strokeDasharray="4 4"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    { theoretical: result, observed: validation, curve },
                    "blackjack-ev-comparison.json",
                  )
                }
              >
                Export EV comparison
              </Button>
            </>
          )}
        </>
      )}
    </>
  );
}
