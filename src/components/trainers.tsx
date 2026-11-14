"use client";
import { legalMinimum } from "@/engine/calibration";
import {
  Card as PlayingCard,
  createShoe,
  evaluate,
  hilo,
  trueCount,
} from "@/engine/cards";
import {
  Action,
  Game,
  deal,
  insurance,
  legalActions,
  newGame,
} from "@/engine/game";
import { builtInIndexProfiles } from "@/engine/index-profiles";
import {
  deviations,
  deviationsSupported,
  explain,
  recommend,
  strategyScope,
  strategySupported,
} from "@/engine/strategy";
import { ActiveTimer } from "@/engine/timer";
import { makeTimedDrill, mastery } from "@/engine/training";
import { useGame } from "@/stores/game-store";
import { ArrowRight, Pause, Play, RotateCcw, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "./card";
import { IndexWorkshop } from "./index-workshop";
import { Metric } from "./metric";
import { StrategyChart } from "./strategy-chart";
import { Button } from "./ui/button";
export function CountingTrainer() {
  const s = useGame(),
    [deck, setDeck] = useState<PlayingCard[]>([]),
    [index, setIndex] = useState(0),
    [mode, setMode] = useState("Guided"),
    [playing, setPlaying] = useState(false),
    [intervalMs, setIntervalMs] = useState(1200),
    [answer, setAnswer] = useState(""),
    [tcAnswer, setTcAnswer] = useState(""),
    [feedback, setFeedback] = useState(""),
    [started, setStarted] = useState(0),
    [checked, setChecked] = useState(-1),
    [elapsed, setElapsed] = useState(0),
    [sprintSeconds, setSprintSeconds] = useState(60);
  const timer = useRef(new ActiveTimer());
  const progressLevel = mastery(
    s.checks.filter((c) => c.kind === "counting"),
    s.timedRecords,
    s.mastery,
  ).level;
  useEffect(() => {
    if (s.autoDifficulty) setIntervalMs([2000, 1200, 650, 300][progressLevel]);
  }, [s.autoDifficulty, progressLevel]);
  useEffect(() => {
    if (playing) timer.current.start();
    else timer.current.pause();
  }, [playing]);
  useEffect(() => {
    const clock = setInterval(() => {
      const ms = timer.current.elapsed();
      setElapsed(ms);
      if (mode === "Timed sprint" && ms >= sprintSeconds * 1000) {
        timer.current.pause();
        setPlaying(false);
      }
    }, 200);
    return () => clearInterval(clock);
  }, [mode, sprintSeconds]);
  const rc = deck.slice(0, index).reduce((sum, c) => sum + hilo(c), 0),
    tc = trueCount(
      rc,
      deck.length - index,
      s.rules.countPrecision,
      s.rules.countRounding,
    ),
    card = deck[index - 1];
  const reset = () => {
    timer.current.reset();
    setElapsed(0);
    setDeck(createShoe(mode === "Deck countdown" ? 1 : s.rules.decks));
    setIndex(0);
    setPlaying(false);
    setFeedback("");
    setChecked(-1);
    setStarted(Date.now());
  };
  useEffect(() => {
    reset();
  }, [mode, s.rules.decks]);
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(
      () => {
        if (
          mode === "Timed sprint" &&
          timer.current.elapsed() >= sprintSeconds * 1000
        ) {
          timer.current.pause();
          setPlaying(false);
          return;
        }
        if (index >= deck.length) {
          setPlaying(false);
          return;
        }
        setIndex(index + 1);
        if (index + 1 >= deck.length) {
          timer.current.pause();
          setPlaying(false);
        }
        setChecked(-1);
        setFeedback("");
      },
      mode === "Challenge" ? Math.max(180, intervalMs - index * 8) : intervalMs,
    );
    return () => clearTimeout(id);
  }, [playing, index, deck.length, intervalMs, mode, sprintSeconds]);
  const check = () => {
    if (
      answer.trim() === "" ||
      !Number.isFinite(Number(answer)) ||
      checked === index
    )
      return;
    const correct = Number(answer) === rc;
    const err =
      tcAnswer.trim() === ""
        ? undefined
        : Math.abs(Number(tcAnswer) - tc.index);
    timer.current.pause();
    const activeMs = timer.current.elapsed();
    setElapsed(activeMs);
    s.score(correct, err);
    if (
      index > 0 &&
      activeMs > 0 &&
      (mode === "Timed sprint" || mode === "Challenge" || index === deck.length)
    )
      s.recordTimed(
        makeTimedDrill({
          mode,
          cards: index,
          activeMs,
          correct,
          runningError: Math.abs(Number(answer) - rc),
          trueError: err,
        }),
      );
    setChecked(index);
    setFeedback(
      `${correct ? "Correct!" : "Keep practicing."} Running count ${rc >= 0 ? "+" : ""}${rc}. True count ${tc.index} (${tc.decks.toFixed(s.rules.countPrecision === 0.25 ? 2 : 1)} estimated decks).${index === deck.length ? " Complete shoes finish at zero." : ""}`,
    );
    setPlaying(false);
  };
  const unaided = [
      "Practice",
      "Challenge",
      "Casino simulation",
      "Deck countdown",
      "Timed sprint",
    ].includes(mode),
    end = index === deck.length && index > 0;
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="COUNTING ACCURACY"
          value={
            s.checks.filter((c) => c.kind === "counting").length
              ? `${Math.round((s.checks.filter((c) => c.kind === "counting" && c.correct).length / s.checks.filter((c) => c.kind === "counting").length) * 100)}%`
              : "—"
          }
          detail={`${s.checks.filter((c) => c.kind === "counting").length} checkpoints completed`}
        />
        <Metric
          label="CARDS OBSERVED"
          value={String(index)}
          detail={`${deck.length - index} remaining`}
        />
        <Metric
          label="PACE"
          value={
            index && started
              ? `${((index / Math.max(0.001, elapsed / 1000)) * 60).toFixed(0)}/min`
              : "—"
          }
          detail={`Active exposure ${(elapsed / 1000).toFixed(1)}s · pauses excluded`}
        />
        <Metric
          label="TRUE COUNT ERROR"
          value={
            s.drills.tcTotal
              ? (s.drills.tcError / s.drills.tcTotal).toFixed(2)
              : "—"
          }
          detail="Mean absolute index error"
        />
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow gold">MENTAL REPETITIONS</div>
            <h2>Keep the count. Find your rhythm.</h2>
          </div>
          <Button variant="outline" onClick={reset}>
            <RotateCcw size={15} /> New shoe
          </Button>
        </div>
        <div className="form-row">
          <label>
            Training mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {[
                "Guided",
                "Practice",
                "Challenge",
                "Casino simulation",
                "Deck countdown",
                "Timed sprint",
              ].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Starting speed
            <select
              disabled={s.autoDifficulty}
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
            >
              <option value={2000}>Beginner · 2 seconds</option>
              <option value={1200}>Intermediate · 1.2 seconds</option>
              <option value={650}>Advanced · 0.65 seconds</option>
              <option value={300}>Expert · 0.3 seconds</option>
            </select>
          </label>
        </div>
        {mode === "Timed sprint" && (
          <label className="compact-label">
            Sprint duration
            <select
              aria-label="Sprint duration"
              value={sprintSeconds}
              onChange={(e) => setSprintSeconds(Number(e.target.value))}
            >
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={120}>120 seconds</option>
            </select>
            <p>
              Active time {(elapsed / 1000).toFixed(1)} / {sprintSeconds}s.
              Submit your count when the sprint stops.
            </p>
          </label>
        )}
        <div className="count-stage">
          {card ? (
            <Card key={`${card.id}-${index}`} card={card} />
          ) : (
            <div className="card-placeholder" />
          )}
          <div>
            <span className="eyebrow">
              {end ? "SHOE COMPLETE" : `CARD ${index} / ${deck.length}`}
            </span>
            <h2>
              {unaided
                ? "Trust your mental count."
                : `Running count: ${rc >= 0 ? "+" : ""}${rc}`}
            </h2>
            <p>
              {mode === "Challenge"
                ? "Speed increases by 8ms per card, to a 180ms minimum."
                : mode === "Deck countdown"
                  ? "A single balanced deck. Finish with a count of zero."
                  : "Count only visible cards. Low +1 · Neutral 0 · High −1."}
            </p>
            {!unaided && (
              <p>
                True count {tc.index} · nearest {s.rules.countPrecision ?? 0.5}{" "}
                deck · {s.rules.countRounding ?? "floor"} rounding
              </p>
            )}
          </div>
        </div>
        <div className="progress-track">
          <i
            style={{
              width: `${deck.length ? (index / deck.length) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="form-row spaced">
          <Button
            disabled={
              end ||
              (mode === "Timed sprint" && elapsed >= sprintSeconds * 1000)
            }
            onClick={() => {
              if (!started) setStarted(Date.now());
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}{" "}
            {playing ? "Pause" : "Auto deal"}
          </Button>
          <Button
            disabled={
              end ||
              playing ||
              (mode === "Timed sprint" && elapsed >= sprintSeconds * 1000)
            }
            variant="outline"
            onClick={() => {
              if (index === 0) timer.current.start();
              setIndex(index + 1);
              setChecked(-1);
              setFeedback("");
            }}
          >
            Next card <ArrowRight size={16} />
          </Button>
        </div>
        {(mode !== "Casino simulation" || end) && (
          <div className="form-row">
            <label>
              Running count
              <input
                type="number"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your count"
              />
            </label>
            <label>
              True count (optional)
              <input
                type="number"
                value={tcAnswer}
                onChange={(e) => setTcAnswer(e.target.value)}
                placeholder="Configured index"
              />
            </label>
            <Button
              onClick={check}
              disabled={playing || checked === index || !index}
            >
              Check count
            </Button>
          </div>
        )}
        {feedback && (
          <div className="notice" role="status">
            {feedback}
          </div>
        )}
      </section>
    </>
  );
}
function nextQuestion(rules: Game["rules"], category = "Mixed"): Game {
  for (let i = 0; i < 1000; i++) {
    let g = deal(
      newGame(rules, Math.max(100000, legalMinimum(rules) * 1000)),
      legalMinimum(rules),
    );
    if (g.phase === "insurance") g = insurance(g, false);
    if (g.phase === "playing" && recommend(g)) {
      const h = g.hands[0],
        v = evaluate(h.cards),
        pair = h.cards[0].rank === h.cards[1].rank;
      if (
        category === "Mixed" ||
        (category === "Soft" && v.soft) ||
        (category === "Hard" && !v.soft && !pair) ||
        (category === "Pairs" && pair) ||
        (category === "Doubling" && recommend(g) === "double") ||
        (category === "Surrender" && recommend(g) === "surrender")
      )
        return g;
    }
  }
  throw Error("Could not generate a drill hand");
}
export function StrategyTrainer() {
  const s = useGame(),
    [g, setG] = useState<Game | null>(null),
    [feedback, setFeedback] = useState(""),
    [selected, setSelected] = useState<Action | null>(null),
    [category, setCategory] = useState("Mixed");
  const next = () => {
    setG(nextQuestion(s.rules, category));
    setFeedback("");
    setSelected(null);
  };
  useEffect(() => {
    if (strategySupported(s.rules)) next();
  }, [s.rules, category]);
  if (!strategySupported(s.rules))
    return (
      <section className="panel">
        <h2>Choose a supported coaching ruleset</h2>
        <p>{strategyScope}</p>
        <a href="#settings">Open table settings →</a>
      </section>
    );
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow gold">ONE DECISION AT A TIME</div>
            <h2>What is your next move?</h2>
            <p>Independent decision drill · uses your current casino rules.</p>
            <label className="compact-label">
              Exercise category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {[
                  "Mixed",
                  "Hard",
                  "Soft",
                  "Pairs",
                  "Doubling",
                  "Surrender",
                ].map((c) => (
                  <option
                    key={c}
                    disabled={c === "Surrender" && !s.rules.surrender}
                  >
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Target className="gold-text" />
        </div>
        {g && (
          <>
            <div className="strategy-stage">
              <div>
                <span className="eyebrow">DEALER UP CARD</span>
                <div className="card-row">
                  <Card card={g.dealer[0]} />
                  <Card hidden />
                </div>
              </div>
              <div>
                <span className="eyebrow">
                  YOUR HAND ·{" "}
                  {evaluate(g.hands[0].cards).soft ? "SOFT" : "HARD"}{" "}
                  {evaluate(g.hands[0].cards).total}
                </span>
                <div className="card-row">
                  {g.hands[0].cards.map((c) => (
                    <Card key={c.id} card={c} />
                  ))}
                </div>
              </div>
            </div>
            <div className="action-buttons">
              {legalActions(g).map((a) => (
                <Button
                  key={a}
                  disabled={selected !== null}
                  variant="outline"
                  onClick={() => {
                    const rec = recommend(g);
                    setSelected(a);
                    s.score(a === rec, undefined, "strategy");
                    setFeedback(
                      `${a === rec ? "Correct." : "Recommended: " + rec + "."} ${explain(g.hands[0], g.dealer[0], rec, g.rules)}`,
                    );
                  }}
                >
                  {a}
                </Button>
              ))}
            </div>
            {feedback && (
              <div className="notice" role="status">
                {feedback}
                <Button size="sm" onClick={next}>
                  Next hand <ArrowRight size={15} />
                </Button>
              </div>
            )}
          </>
        )}
        <p className="micro">
          Drill scores are saved as training checkpoints; live-table decision
          accuracy is tracked separately in Analytics.
        </p>
      </section>
      <StrategyChart rules={s.rules} />
    </>
  );
}
export function DeviationsPanel() {
  const r = useGame((s) => s.rules),
    supported = deviationsSupported(r, builtInIndexProfiles[0]),
    [filter, setFilter] = useState("I18");
  return (
    <>
      <IndexWorkshop />
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow gold">BEYOND BASIC STRATEGY</div>
            <h2>Know when the count changes the play.</h2>
            <p>
              Hi-Lo indices · six decks · S17 · US peek · DAS · floor true
              count, nearest ½ deck.
            </p>
          </div>
          <span className={`tag ${supported ? "green-tag" : ""}`}>
            {supported ? "APPLICABLE" : "REFERENCE ONLY"}
          </span>
        </div>
        {!supported && (
          <div className="notice">
            Your current rules are outside this index profile. Live index
            coaching and deviation simulation are disabled. Select six-deck S17,
            peek, DAS, double any two and standard split rules to enable.
          </div>
        )}
        <div className="segmented">
          <button
            className={filter === "I18" ? "selected" : ""}
            onClick={() => setFilter("I18")}
          >
            Illustrious 18
          </button>
          <button
            className={filter === "F4" ? "selected" : ""}
            onClick={() => setFilter("F4")}
          >
            Fab 4 surrender
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PLAYER HAND</th>
                <th>DEALER</th>
                <th>TC INDEX</th>
                <th>AT / ABOVE INDEX</th>
                <th>BELOW INDEX</th>
              </tr>
            </thead>
            <tbody>
              {deviations
                .filter((x) => x.set === filter)
                .map((x, i) => (
                  <tr key={i}>
                    <td>
                      {x.hand === 0
                        ? "Any (insurance)"
                        : x.pair
                          ? "10 + 10"
                          : `Hard ${x.hand}`}
                    </td>
                    <td>{x.dealer === 11 ? "A" : x.dealer}</td>
                    <td className="gold-text">
                      {x.index >= 0 ? "+" : ""}
                      {x.index}
                    </td>
                    <td>{x.above}</td>
                    <td>{x.hand === 0 ? "Decline insurance" : x.below}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="micro">
          Surrender requires an eligible original two-card hand. Split/double
          indices require those actions to be legal; otherwise use basic
          strategy. Pair 8s retain pair strategy unless a legal surrender index
          applies. These are educational conventional indices, not
          composition-dependent optimal play.
        </p>
        <p className="micro">
          Reference:{" "}
          <a
            target="_blank"
            rel="noreferrer"
            href="https://wizardofodds.com/games/blackjack/card-counting/high-low/"
          >
            Wizard of Odds · Hi-Lo index tables
          </a>
          , crediting Don Schlesinger’s Blackjack Attack. Different counting,
          rounding or casino rules can change indices.
        </p>
      </section>
    </>
  );
}
