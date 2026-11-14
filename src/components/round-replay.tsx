"use client";
import { evaluate } from "@/engine/cards";
import { reconstructCounts, replayFrames } from "@/engine/replay";
import { money } from "@/lib/format";
import { ArchivedRound, loadRound } from "@/lib/storage";
import { useEffect, useState } from "react";
import { Card } from "./card";
import { Button } from "./ui/button";
export function RoundReplay({ id }: { id: string }) {
  const [archive, setArchive] = useState<ArchivedRound | null>(null),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(600),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setStep(0);
    setPlaying(false);
    void loadRound(id).then((r) => {
      if (alive) {
        setArchive(r ?? null);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);
  const frames = archive ? replayFrames(archive.events) : [],
    current = frames[step],
    frame = current?.frame,
    counts = archive ? reconstructCounts(archive.events) : [];
  useEffect(() => {
    if (!playing) return;
    if (step >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setStep((x) => x + 1), speed);
    return () => clearTimeout(timer);
  }, [playing, step, frames.length, speed]);
  if (!loaded) return <p className="micro">Loading archived event history…</p>;
  if (!archive || !frames.length)
    return (
      <p className="notice">
        This older round has decision summaries but no event-level replay. Newly
        played rounds record the full timeline.
      </p>
    );
  return (
    <section className="replay-panel">
      <div className="panel-header">
        <h3>Visual round replay · {archive.record.round}</h3>
        <span className="tag">READ ONLY</span>
      </div>
      <div className="form-row">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (step >= frames.length - 1) setStep(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause replay" : "Play replay"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={step <= 0}
          onClick={() => {
            setPlaying(false);
            setStep(step - 1);
          }}
        >
          Previous event
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={step >= frames.length - 1}
          onClick={() => {
            setPlaying(false);
            setStep(step + 1);
          }}
        >
          Next event
        </Button>
        <label>
          Replay speed
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value={1200}>Slow</option>
            <option value={600}>Normal</option>
            <option value={150}>Fast</option>
          </select>
        </label>
      </div>
      <input
        aria-label="Replay event"
        type="range"
        min={0}
        max={Math.max(0, frames.length - 1)}
        value={step}
        onChange={(e) => {
          setPlaying(false);
          setStep(Number(e.target.value));
        }}
      />
      <p role="status">
        Event {step + 1}/{frames.length}:{" "}
        {current?.event.kind.replaceAll("-", " ")}
        {current?.event.card && current.event.visible
          ? ` · ${current.event.card.rank} ${current.event.card.suit}`
          : ""}
      </p>
      {frame && (
        <div className="replay-felt">
          <span className="eyebrow">DEALER</span>
          <div className="card-row">
            {frame.dealer.map((c, i) => (
              <Card
                key={c.id}
                card={c}
                hidden={i === 1 && !frame.revealed}
                small
              />
            ))}
          </div>
          <div className="player-hands">
            {frame.hands.map((h, i) => (
              <div key={i}>
                <span className="eyebrow">
                  HAND {i + 1} · {h.result ?? ""}{" "}
                  {h.doubled ? " · DOUBLED" : h.split ? " · SPLIT" : ""}
                </span>
                <div className="card-row">
                  {h.cards.map((c) => (
                    <Card key={c.id} card={c} small />
                  ))}
                </div>
                <p>
                  {evaluate(h.cards, h.split).total} · wager {money(h.bet)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="stat-strip">
        <span>
          Running count<b>{current?.event.running}</b>
        </span>
        <span>
          True count<b>{current?.event.trueCount}</b>
        </span>
        <span>
          Cards observed<b>{current?.event.seen}</b>
        </span>
        <span>
          Cards in shoe<b>{current?.event.remaining}</b>
        </span>
        <span>
          Available bankroll<b>{frame ? money(frame.bankroll) : "—"}</b>
        </span>
      </div>
      <p className="micro">
        Count reconstruction:{" "}
        {counts.every((c) => c.valid)
          ? "all recorded visible-card tags reconcile"
          : "mismatch detected"}
        . Replay follows historical information; hole-card faces stay concealed
        until their reveal event. It never changes the live game.
      </p>
      <details>
        <summary>Complete event timeline</summary>
        <div className="scroll-list">
          {frames.map(({ event }, i) => (
            <button
              className="history-row"
              key={i}
              onClick={() => {
                setPlaying(false);
                setStep(i);
              }}
            >
              <span>
                {i + 1}. {event.kind.replaceAll("-", " ")}
              </span>
              <span>
                RC {event.running} · TC {event.trueCount}
              </span>
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
