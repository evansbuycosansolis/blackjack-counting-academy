"use client";
import { achievements, mastery } from "@/engine/training";
import { summarize } from "@/lib/analytics";
import { useGame } from "@/stores/game-store";
import { useState } from "react";
import { Button } from "./ui/button";
export function TrainingProgress() {
  const s = useGame(),
    m = mastery(
      s.checks.filter((c) => c.kind === "counting"),
      s.timedRecords,
      s.mastery,
    ),
    badges = achievements(
      s.checks,
      s.timedRecords,
      summarize(s.history).hands,
      s.completed,
    );
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow gold">MEASURABLE MASTERY</div>
          <h2>
            {m.label} ·{" "}
            {m.mastered
              ? "Mastery thresholds achieved"
              : "Your next training milestone"}
          </h2>
          <p>
            Recent accuracy {(m.accuracy * 100).toFixed(1)}% · best verified
            pace {m.bestSpeed.toFixed(1)} cards/minute. Accuracy and speed both
            matter.
          </p>
        </div>
        <span className="tag">LEVEL {m.level + 1}</span>
      </div>
      <div className="form-grid">
        <label>
          Target accuracy (%)
          <input
            type="number"
            min={50}
            max={100}
            value={s.mastery.accuracy * 100}
            onChange={(e) =>
              s.setMastery({
                ...s.mastery,
                accuracy: Math.max(
                  0.5,
                  Math.min(1, Number(e.target.value) / 100),
                ),
              })
            }
          />
        </label>
        <label>
          Required recent attempts
          <input
            type="number"
            min={5}
            max={100}
            value={s.mastery.attempts}
            onChange={(e) =>
              s.setMastery({
                ...s.mastery,
                attempts: Math.max(
                  5,
                  Math.min(100, Math.floor(Number(e.target.value))),
                ),
              })
            }
          />
        </label>
        <label>
          Target cards/minute
          <input
            type="number"
            min={10}
            max={300}
            value={s.mastery.cardsPerMinute}
            onChange={(e) =>
              s.setMastery({
                ...s.mastery,
                cardsPerMinute: Math.max(
                  10,
                  Math.min(300, Number(e.target.value)),
                ),
              })
            }
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={s.autoDifficulty}
            onChange={(e) => s.setAutoDifficulty(e.target.checked)}
          />{" "}
          Progress counting speed automatically with mastery level
        </label>
      </div>
      <div className="achievement-grid">
        {badges.map((b) => (
          <div className={`achievement ${b.earned ? "earned" : ""}`} key={b.id}>
            <strong>
              {b.earned ? "✓ " : ""}
              {b.name}
            </strong>
            <p>{b.description}</p>
            <small>{b.earned ? "Earned" : "In progress"}</small>
          </div>
        ))}
      </div>
      {s.timedRecords.length > 0 && (
        <>
          <h3>Timed drill records</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Cards</th>
                  <th>Active seconds</th>
                  <th>Cards/min</th>
                  <th>Count result</th>
                </tr>
              </thead>
              <tbody>
                {s.timedRecords
                  .slice(-20)
                  .reverse()
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.date).toLocaleString()}</td>
                      <td>{r.mode}</td>
                      <td>{r.cards}</td>
                      <td>{(r.activeMs / 1000).toFixed(1)}</td>
                      <td>{r.cardsPerMinute.toFixed(1)}</td>
                      <td>
                        {r.correct ? "Correct" : `Error ${r.runningError}`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
const quiz = [
  {
    q: "A + 5 + 9 is hard 15. True or false?",
    a: true,
    why: "The Ace becomes 1, producing 15.",
  },
  {
    q: "A split Ace plus a King receives a natural blackjack payout.",
    a: false,
    why: "A split-hand 21 is ordinary 21 and pays even money.",
  },
  {
    q: "The visible sequence 4, 5, K, A has Hi-Lo count zero.",
    a: true,
    why: "+1 +1 −1 −1 = 0.",
  },
  {
    q: "RC −2 with 3 decks remaining floors to TC zero.",
    a: false,
    why: "−2/3 floors to −1; truncation would give zero.",
  },
  {
    q: "Insurance breaks even when one third of unknown cards are ten-valued.",
    a: true,
    why: "Net insurance EV is 2p − (1−p) = 3p−1.",
  },
  {
    q: "A 6:5 natural on a 10-chip wager earns 15 chips profit.",
    a: false,
    why: "6:5 earns 12 chips; 3:2 earns 15.",
  },
  {
    q: "A dealer must hit hard 16 under either S17 or H17.",
    a: true,
    why: "Both rules draw below 17; they differ only at soft 17.",
  },
  {
    q: "A positive count guarantees the dealer will bust.",
    a: false,
    why: "Individual hands remain uncertain.",
  },
  {
    q: "If the shoe crosses the cut card, the next round starts with a new shuffle.",
    a: true,
    why: "This application completes the current round before reshuffling.",
  },
  {
    q: "Resampling individual hands gives a valid ruin estimate for a persistent-shoe session.",
    a: false,
    why: "It destroys dependence within the shoe; independent complete sessions are the sampling unit.",
  },
];
export function AcademyExercises() {
  const s = useGame(),
    [index, setIndex] = useState(0),
    [result, setResult] = useState(""),
    [answered, setAnswered] = useState(false),
    x = quiz[index % quiz.length];
  return (
    <section className="panel">
      <h2>Applied academy exercises</h2>
      <p>
        Use the rules, counting conventions and probability relationships in
        concrete situations.
      </p>
      <div className="lesson-example">
        <span className="eyebrow gold">EXERCISE {index + 1}</span>
        <h3>{x.q}</h3>
        <div className="form-row spaced">
          {[true, false].map((a) => (
            <Button
              key={String(a)}
              variant="outline"
              disabled={answered}
              onClick={() => {
                const correct = a === x.a;
                s.score(correct, undefined, "strategy");
                setResult(
                  `${correct ? "Correct." : "Review this principle."} ${x.why}`,
                );
                setAnswered(true);
              }}
            >
              {a ? "True" : "False"}
            </Button>
          ))}
        </div>
        {result && (
          <p role="status" className="notice">
            {result}
          </p>
        )}
        <Button
          disabled={!answered}
          onClick={() => {
            setIndex(index + 1);
            setResult("");
            setAnswered(false);
          }}
        >
          Next applied exercise
        </Button>
      </div>
    </section>
  );
}
