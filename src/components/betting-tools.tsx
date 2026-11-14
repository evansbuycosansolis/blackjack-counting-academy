"use client";
import { rulesKey } from "@/engine/calibration";
import { selectProfile } from "@/engine/index-profiles";
import { SimulationConfig } from "@/engine/simulation";
import { useGame } from "@/stores/game-store";
import { NamedRamp, useLab } from "@/stores/lab-store";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
export function BettingTools() {
  const s = useGame(),
    lab = useLab(),
    [id, setId] = useState("example"),
    [name, setName] = useState("My betting ramp"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const chosen = lab.runs
      .filter((r) =>
        (selectedRuns.length
          ? selectedRuns
          : lab.runs.slice(-2).map((r) => r.id)
        ).includes(r.id),
      )
      .slice(-5),
    rows = new Map<number, Record<string, number>>();
  for (let i = 0; i < chosen.length; i++)
    for (const p of chosen[i].result.points) {
      const row = rows.get(p.hand) ?? { round: p.hand };
      row[`run${i}`] = p.profit;
      rows.set(p.hand, row);
    }
  const comparison = [...rows.values()].sort((a, b) => a.round - b.round);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const model = lab.models.find(
    (m) => m.rulesKey === rulesKey(s.rules) && m.policy === "basic",
  );
  const save = (duplicate = false) => {
    try {
      const ramp: NamedRamp = {
        id:
          duplicate || !lab.ramps.some((r) => r.id === id)
            ? crypto.randomUUID()
            : id,
        name: name.trim(),
        rows: s.ramp,
      };
      lab.saveRamp(ramp);
      setId(ramp.id);
      setMessage(`Saved ${ramp.name}.`);
    } catch (e) {
      setMessage(String(e));
    }
  };
  const calibrate = () => {
    worker.current?.terminate();
    const w = new Worker(
      new URL("../workers/simulation.worker.ts", import.meta.url),
    );
    worker.current = w;
    setBusy(true);
    setProgress(0);
    setMessage("");
    const config: SimulationConfig = {
      rules: s.rules,
      hands: 100000,
      seed: 81573,
      bankroll: 100000000,
      mode: "flat",
      unit: Math.max(
        s.rules.min,
        Math.ceil(s.rules.min / (s.rules.betIncrement ?? 1)) *
          (s.rules.betIncrement ?? 1),
      ),
      ramp: s.ramp,
      kelly: 0.25,
      deviations: false,
      stopLoss: 0,
      stopWin: 0,
      indexProfile: selectProfile(s.rules, s.activeIndexId, s.indexProfiles),
    };
    w.onmessage = (e) => {
      if (e.data.type === "progress") setProgress(e.data.hands);
      if (e.data.type === "done") {
        if (e.data.result.edgeModel) lab.saveModel(e.data.result.edgeModel);
        setBusy(false);
        setMessage(
          `${e.data.result.reason}: calibration saved from ${e.data.result.hands.toLocaleString()} flat-bet rounds.`,
        );
        w.terminate();
      }
      if (e.data.type === "error") {
        setBusy(false);
        setMessage(e.data.message);
        w.terminate();
      }
    };
    w.onerror = (e) => {
      setBusy(false);
      setMessage(e.message);
    };
    w.postMessage({ type: "start", config });
  };
  return (
    <section className="panel">
      <h2>Saved betting ramps & empirical Kelly calibration</h2>
      <p>
        Save the working ramp below as a named strategy. Loading a ramp replaces
        the working editor; saved copies remain available.
      </p>
      <div className="form-row">
        <label>
          Named ramp
          <select
            aria-label="Named betting ramp"
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="new">New ramp</option>
            {lab.ramps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() => {
            const r = lab.ramps.find((r) => r.id === id);
            if (r) {
              s.setRamp(structuredClone(r.rows));
              setName(r.name);
              setMessage("Loaded into the working ramp editor.");
            }
          }}
        >
          Load ramp
        </Button>
        <label>
          Ramp name
          <input
            aria-label="Ramp name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button onClick={() => save(false)}>Save ramp</Button>
        <Button variant="outline" onClick={() => save(true)}>
          Duplicate ramp
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            lab.deleteRamp(id);
            setId("new");
            setMessage("Deleted saved ramp. Working editor is retained.");
          }}
        >
          Delete ramp
        </Button>
      </div>
      <div className="notice">
        <b>Kelly uses measured outcome distributions</b>
        <p>
          No generic count-to-edge formula is used for wagering. A separate
          flat-bet pilot measures return distributions at each wager count under
          these exact rules and policy. Empirical log-growth optimization
          determines the Kelly fraction; your chosen fraction scales it. Bins
          with fewer than 100 rounds or five shoes use the fixed unit rather
          than inventing an edge. Sparse and uncertain tails remain visible.
        </p>
        <div className="form-row">
          <Button disabled={busy} onClick={calibrate}>
            Calibrate 100,000 rounds
          </Button>
          {busy && (
            <Button
              variant="outline"
              onClick={() => worker.current?.postMessage({ type: "cancel" })}
            >
              Cancel calibration
            </Button>
          )}
        </div>
        {busy && (
          <p role="status">
            Calibration: {progress.toLocaleString()} / 100,000 rounds
          </p>
        )}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {model && (
        <>
          <p className="micro">
            {model.method} · {model.rounds.toLocaleString()} rounds · seed{" "}
            {model.seed}. Calibration is specific to these saved rules and basic
            strategy.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Wager TC</th>
                  <th>Rounds</th>
                  <th>Shoes</th>
                  <th>Mean unit return</th>
                  <th>95% shoe-cluster interval</th>
                  <th>Empirical full Kelly</th>
                </tr>
              </thead>
              <tbody>
                {model.bins.map((b) => (
                  <tr key={b.tc}>
                    <td>
                      {b.tc === -10 ? "≤−10" : b.tc === 10 ? "≥10" : b.tc}
                    </td>
                    <td>{b.samples}</td>
                    <td>{b.shoes}</td>
                    <td>{(b.mean * 100).toFixed(2)}%</td>
                    <td>
                      {b.shoes > 1 && b.ci95.every(Number.isFinite)
                        ? `${(b.ci95[0] * 100).toFixed(2)}% to ${(b.ci95[1] * 100).toFixed(2)}%`
                        : "Insufficient shoes"}
                    </td>
                    <td>
                      {b.samples >= 100 && b.shoes >= 5
                        ? `${(b.kellyFraction * 100).toFixed(3)}% of bankroll`
                        : "Fixed-unit fallback"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {lab.runs.length > 0 && (
        <>
          <h3>Saved simulation comparisons</h3>
          <p className="micro">
            These runs survive reloads. Their full rules, seeds and calibration
            inputs remain attached.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Rounds</th>
                  <th>Plot</th>
                  <th>P/L</th>
                  <th>Drawdown</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lab.runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.name}
                      <small>{new Date(r.date).toLocaleString()}</small>
                    </td>
                    <td>{r.result.hands.toLocaleString()}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Plot run ${r.id}`}
                        checked={chosen.some((x) => x.id === r.id)}
                        onChange={(e) =>
                          setSelectedRuns(
                            e.target.checked
                              ? [...chosen.map((x) => x.id), r.id].slice(-5)
                              : chosen
                                  .filter((x) => x.id !== r.id)
                                  .map((x) => x.id),
                          )
                        }
                      />
                    </td>
                    <td>{r.result.profit.toFixed(2)}</td>
                    <td>{r.result.maxDrawdown.toFixed(2)}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => lab.deleteRun(r.id)}
                      >
                        Delete run
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {comparison.length > 0 && (
            <div className="chart">
              <ResponsiveContainer>
                <LineChart data={comparison}>
                  <XAxis
                    dataKey="round"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    stroke="#7f9187"
                  />
                  <YAxis stroke="#7f9187" />
                  <Tooltip />
                  <Legend />
                  {chosen.map((r, i) => (
                    <Line
                      key={r.id}
                      name={r.name}
                      dataKey={`run${i}`}
                      connectNulls
                      stroke={
                        ["#b6ce8a", "#d5b876", "#91b8c8", "#bc9dd8", "#dd9d8b"][
                          i
                        ]
                      }
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </section>
  );
}
