"use client";
import { useEffect, useRef, useState } from "react";
import type { AnalysisResult } from "@/engine/analysis";
import { useGame } from "@/stores/game-store";
import { Button } from "./ui/button";

/** Deliberately separate from total-dependent chart accuracy and index coaching. */
export function CompositionCoach() {
  const game = useGame((s) => s.game);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  const key = game
    ? `${game.shuffles}/${game.round}/${game.cursor}/${game.active}/${game.phase}`
    : "";
  useEffect(() => {
    worker.current?.terminate();
    setResult(null);
    setMessage("");
    setBusy(false);
    return () => worker.current?.terminate();
  }, [key]);
  if (!game || game.phase !== "playing") return null;
  return (
    <div className="composition-coach">
      <h3>Composition-dependent coach</h3>
      <p className="micro">
        Solves the actual exposed-card composition and legal actions, including
        split caps, split Aces, restricted DAS and delayed blackjack rules. This
        can differ from a total-dependent basic chart and is separate from
        chart-accuracy scoring.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => {
          worker.current?.terminate();
          const w = new Worker(
            new URL("../workers/analysis.worker.ts", import.meta.url),
          );
          worker.current = w;
          setBusy(true);
          setMessage("");
          w.onmessage = (e) => {
            if (e.data.type === "done") {
              setResult(e.data.result);
              setBusy(false);
              w.terminate();
            }
            if (e.data.type === "error") {
              setMessage(e.data.message);
              setBusy(false);
              w.terminate();
            }
          };
          w.onerror = (e) => {
            setMessage(e.message);
            setBusy(false);
            w.terminate();
          };
          w.postMessage({
            type: "analyze",
            game,
            samples: 0,
            seed: 0,
            exactOnly: true,
            exactLimit: 150000,
          });
        }}
      >
        Solve current decision exactly
      </Button>
      {busy && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            worker.current?.terminate();
            setBusy(false);
            setMessage("Calculation cancelled; no recommendation issued.");
          }}
        >
          Cancel exact coach
        </Button>
      )}
      {busy && <p role="status">Enumerating legal future decisions…</p>}
      {message && (
        <p role="status" className="micro">
          {message}
        </p>
      )}
      {result && (
        <div role="status">
          <b>Exact composition action: {result.recommended}</b>
          <p className="micro">
            {result.states.toLocaleString()} states · net EV per original round
            wager · optimal future actions
          </p>
          <ul>
            {result.actions.map((x) => (
              <li key={x.action}>
                {x.action}: {x.ev.toFixed(5)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
