"use client";
import { evaluate, trueCount, value } from "@/engine/cards";
import { Action, legalActions } from "@/engine/game";
import { observablePool } from "@/engine/probabilities";
import {
  adjusted,
  deviationsSupported,
  explain,
  recommend,
} from "@/engine/strategy";
import { useGame } from "@/stores/game-store";
import {
  ArrowDown,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Layers,
  Lightbulb,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Split,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Card } from "./card";
import { Button } from "./ui/button";

import { wager } from "@/engine/betting";
import { legalMinimum, rulesKey } from "@/engine/calibration";
import { selectProfile } from "@/engine/index-profiles";
import { money } from "@/lib/format";
import { useLab } from "@/stores/lab-store";
import { ProbabilityInsights } from "./probability-insights";
import { CompositionCoach } from "./composition-coach";
const shortcuts: Record<string, Action> = {
  h: "hit",
  s: "stand",
  d: "double",
  p: "split",
  r: "surrender",
};
export function PlayTable() {
  const s = useGame(),
    g = s.game!;
  const lab = useLab(),
    reduced = useReducedMotion();
  const [bet, setBet] = useState(legalMinimum(g.rules)),
    [feedback, setFeedback] = useState(""),
    [guess, setGuess] = useState(""),
    [checkedAt, setCheckedAt] = useState("");
  const last = useRef({ at: 0, key: "" });
  const previousCards = useRef({ shoe: g.shuffles, ids: new Set<string>() });
  const newlyDealt = (id: string) =>
    previousCards.current.shoe !== g.shuffles ||
    !previousCards.current.ids.has(id);
  useEffect(() => {
    if (previousCards.current.shoe !== g.shuffles)
      previousCards.current = { shoe: g.shuffles, ids: new Set() };
    for (const card of [...g.dealer, ...g.hands.flatMap((hand) => hand.cards)])
      previousCards.current.ids.add(card.id);
  }, [g]);
  const allowed = legalActions(g),
    h = g.hands[g.active],
    tc = trueCount(
      g.running,
      g.shoe.length - g.cursor,
      g.rules.countPrecision,
      g.rules.countRounding,
    ),
    hide = s.casino || !s.countVisible;
  const advice = recommend(g),
    profile = selectProfile(g.rules, s.activeIndexId, s.indexProfiles),
    countAdvice =
      profile && deviationsSupported(g.rules, profile)
        ? adjusted(g, undefined, profile)
        : null;
  const unknown = observablePool(g.shoe, g.cursor, g.dealer, g.revealed);
  const highConcentration = unknown.length
    ? unknown.filter((c) => value(c) >= 10).length / unknown.length
    : 0;
  const betTC =
    g.cursor >= Math.floor(g.shoe.length * g.rules.penetration) ? 0 : tc.index;
  let suggested: number | null = null;
  try {
    suggested = wager(
      s.bettingMode === "manual" ? "ramp" : s.bettingMode,
      betTC,
      g.bankroll / 100,
      g.rules,
      s.bettingUnit,
      s.ramp,
      s.bettingKelly,
      lab.models.find(
        (m) => m.rulesKey === rulesKey(g.rules) && m.policy === "basic",
      ),
    );
  } catch {
    /* Calibration requirements are shown by the recommendation control. */
  }
  const dealHand = () => {
    if (s.paused) return;
    s.deal(bet);
  };
  const playAction = (a: Action) => {
    const key = `${g.round}-${g.active}-${a}`;
    if (
      (last.current.key === key && Date.now() - last.current.at < 160) ||
      s.paused
    )
      return;
    last.current = { at: Date.now(), key };
    if (s.sound) {
      const Ctx = window.AudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.025;
      osc.frequency.value = 420;
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
      osc.onended = () => void ctx.close();
    }
    s.action(a);
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,select,textarea") ||
        e.ctrlKey ||
        e.metaKey ||
        e.repeat
      )
        return;
      const a = shortcuts[e.key.toLowerCase()];
      if (a && allowed.includes(a)) {
        e.preventDefault();
        playAction(a);
      }
      if (e.code === "Space" && ["betting", "settled"].includes(g.phase)) {
        e.preventDefault();
        dealHand();
      }
    };
    addEventListener("keydown", fn);
    return () => removeEventListener("keydown", fn);
  });
  useEffect(() => {
    const increment = g.rules.betIncrement ?? 1;
    setBet((previous) =>
      Math.max(
        legalMinimum(g.rules),
        Math.min(
          Math.floor(g.rules.max / increment) * increment,
          Math.floor(previous / increment) * increment,
        ),
      ),
    );
  }, [g.rules.min, g.rules.max, g.rules.betIncrement]);
  const check = () => {
    const checkpoint = `${g.shuffles}-${g.cursor}`;
    if (
      guess.trim() === "" ||
      !Number.isFinite(Number(guess)) ||
      checkedAt === checkpoint
    )
      return;
    setCheckedAt(checkpoint);
    const correct = Number(guess) === g.running;
    s.score(correct);
    setFeedback(
      correct
        ? "Correct — your running count is on track."
        : `Running count: ${g.running >= 0 ? "+" : ""}${g.running}. Review only exposed cards.`,
    );
  };
  return (
    <div className={`play-layout ${s.casino ? "casino-only" : ""}`}>
      <section className="table-panel">
        <div className="table-toolbar">
          <div>
            <span className="live-dot" />
            <strong>Practice table</strong>
            <span className="tag">{g.rules.decks} DECKS</span>
          </div>
          <div className="table-tools">
            <button
              className="icon-btn"
              aria-label={s.paused ? "Resume session" : "Pause session"}
              onClick={() => s.toggle("paused")}
            >
              {s.paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              className="icon-btn"
              aria-label="Toggle sound"
              onClick={() => s.toggle("sound")}
            >
              {s.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </div>
        <LayoutGroup id="live-blackjack-table">
          <div className="felt">
            <AnimatePresence>
              {g.phase === "settled" && (
                <motion.div
                  key={`payout-${g.round}`}
                  className={`payout-feedback ${g.bankroll > g.roundStart ? "won" : g.bankroll < g.roundStart ? "lost" : "pushed"}`}
                  initial={{ opacity: 0, scale: 0.85, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : s.speed }}
                  role="status"
                >
                  <strong>
                    {g.bankroll > g.roundStart
                      ? g.hands.some((hand) => hand.result === "Blackjack")
                        ? "BLACKJACK"
                        : "WIN"
                      : g.bankroll < g.roundStart
                        ? "LOSS"
                        : "PUSH"}
                  </strong>
                  <span>
                    {g.bankroll - g.roundStart >= 0 ? "+" : ""}
                    {money(g.bankroll - g.roundStart)}
                  </span>
                  <div className="payout-chip-flight" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <motion.i
                        key={i}
                        className="animated-chip"
                        initial={{
                          y: reduced
                            ? 0
                            : g.bankroll >= g.roundStart
                              ? -85
                              : 65,
                          x: i * 18 - 18,
                          opacity: 0,
                        }}
                        animate={{
                          y: reduced
                            ? 0
                            : g.bankroll >= g.roundStart
                              ? 75
                              : -75,
                          opacity: [0, 1, 1, 0],
                        }}
                        transition={{
                          duration: reduced ? 0 : Math.max(0.7, s.speed * 4),
                          delay: reduced ? 0 : i * 0.08,
                        }}
                      >
                        ♠
                      </motion.i>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {g.shuffles > 1 && (
              <motion.div
                key={`shuffle-${g.shuffles}`}
                className="shuffle-notice"
                initial={{ opacity: 1 }}
                animate={{ opacity: [1, 1, 0] }}
                transition={{
                  duration: reduced ? 0 : Math.max(0.8, s.speed * 5),
                  times: [0, 0.6, 1],
                }}
              >
                New shoe · count reset
              </motion.div>
            )}
            <div className="felt-rule">
              BLACKJACK PAYS {g.rules.payout}
              <span>
                Dealer {g.rules.hitSoft17 ? "hits" : "stands on"} soft 17 ·
                Insurance pays 2 to 1
              </span>
            </div>
            <div
              className="shoe-visual"
              title={`${g.shoe.length - g.cursor} cards physically in shoe`}
            >
              <div className="shuffle-deck" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.i
                    key={`${g.shuffles}-${i}`}
                    initial={{
                      x:
                        (i % 2 ? 1 : -1) *
                        (g.shuffles > 1 && !reduced ? 24 : 0),
                      y: -i * 2,
                      rotate:
                        (i % 2 ? 1 : -1) *
                        (g.shuffles > 1 && !reduced ? 16 : 0),
                    }}
                    animate={{ x: 0, y: -i * 2, rotate: 0 }}
                    transition={{
                      duration: reduced ? 0 : Math.max(0.2, s.speed * 3),
                      delay: reduced ? 0 : i * s.speed * 0.15,
                    }}
                  />
                ))}
              </div>
              <motion.span
                key={g.shuffles}
                initial={{
                  rotate: g.shuffles > 1 ? -18 : 0,
                  x: g.shuffles > 1 ? -5 : 0,
                }}
                animate={{ rotate: 0, x: 0 }}
                transition={{
                  duration: reduced ? 0 : Math.max(0.1, s.speed),
                  repeat: g.shuffles > 1 ? 3 : 0,
                  repeatType: "reverse",
                }}
              >
                <Layers size={28} />
              </motion.span>
              <small>SHOE</small>
            </div>
            <div className="discard-visual">
              <div />
              <div />
              <div />
              <small>DISCARDS {g.discards.length}</small>
            </div>
            <div className="dealer-seat">
              <div className="seat-label">
                DEALER{" "}
                {g.dealer.length > 0 && (
                  <b>
                    {g.revealed
                      ? evaluate(g.dealer).total
                      : evaluate(g.dealer.slice(0, 1)).total}
                  </b>
                )}
              </div>
              <div className="card-row">
                {g.dealer.length ? (
                  g.dealer.map((c, i) => (
                    <Card
                      key={c.id}
                      card={c}
                      hidden={i === 1 && !g.revealed}
                      index={i}
                      table
                      flight={newlyDealt(c.id)}
                    />
                  ))
                ) : (
                  <>
                    <div className="card-placeholder" />
                    <div className="card-placeholder" />
                  </>
                )}
              </div>
            </div>
            <div className="table-inscription">
              <span>BLACKJACK</span>
              <small>COUNTING ACADEMY</small>
            </div>
            <div className="player-hands">
              {g.hands.length ? (
                g.hands.map((hand, i) => (
                  <motion.div
                    layout
                    transition={{ duration: reduced ? 0 : s.speed }}
                    key={hand.cards[0]?.id ?? i}
                    className={`player-hand ${i === g.active && g.phase === "playing" ? "active-hand" : ""}`}
                  >
                    <div className="card-row">
                      {hand.cards.map((c, j) => (
                        <Card
                          key={c.id}
                          card={c}
                          index={j}
                          table
                          flight={newlyDealt(c.id)}
                        />
                      ))}
                    </div>
                    <div className="seat-label">
                      {hand.result ??
                        (hand.split ? `HAND ${i + 1}` : "YOUR HAND")}{" "}
                      <b>
                        {evaluate(hand.cards, hand.split).soft ? "Soft " : ""}
                        {evaluate(hand.cards, hand.split).total}
                      </b>
                    </div>
                    <span className="hand-bet">
                      <motion.i
                        key={`${g.round}-${hand.bet}`}
                        className="animated-chip hand-chip"
                        aria-hidden="true"
                        initial={{ y: reduced ? 0 : 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: reduced ? 0 : s.speed }}
                      >
                        ♠
                      </motion.i>
                      {money(hand.bet)}
                      {hand.doubled ? " · DOUBLE" : ""}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="player-hand">
                  <div className="card-row">
                    <div className="card-placeholder" />
                    <div className="card-placeholder" />
                  </div>
                  <div className="seat-label">YOUR SEAT</div>
                </div>
              )}
            </div>
            <div className="bet-circle">
              <motion.span
                key={`wager-${g.round}`}
                className="table-chip"
                initial={{ y: reduced ? 0 : 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: reduced ? 0 : s.speed }}
              >
                {g.initialBet ? g.initialBet / 100 : bet}
              </motion.span>
            </div>
            <div className="table-bottom">
              <span>
                <i /> VIRTUAL CHIPS ONLY
              </span>
              <span>
                ROUND{" "}
                {String(g.round + Number(g.phase === "betting")).padStart(
                  3,
                  "0",
                )}
              </span>
            </div>
            {s.paused && (
              <div className="paused-overlay">
                <Pause />
                <h2>Session paused</h2>
                <Button onClick={() => s.toggle("paused")}>
                  Resume practice
                </Button>
              </div>
            )}
          </div>
        </LayoutGroup>
        <div className="round-message" aria-live="polite">
          {g.message}
        </div>
        <div className="action-area">
          {["betting", "settled"].includes(g.phase) && (
            <div className="bet-guidance">
              <label>
                Betting exercise
                <select
                  aria-label="Live betting method"
                  value={s.bettingMode}
                  onChange={(e) =>
                    s.setBetting(
                      e.target.value as typeof s.bettingMode,
                      s.bettingUnit,
                      s.bettingKelly,
                    )
                  }
                >
                  <option value="manual">Manual · compare to ramp</option>
                  <option value="flat">Flat unit</option>
                  <option value="ramp">Working count ramp</option>
                  <option value="kelly">Calibrated ¼ Kelly</option>
                </select>
              </label>
              <label>
                Unit
                <input
                  aria-label="Live betting unit"
                  type="number"
                  min={1}
                  step={1}
                  value={s.bettingUnit}
                  onChange={(e) =>
                    s.setBetting(
                      s.bettingMode,
                      Math.max(1, Math.floor(Number(e.target.value))),
                      s.bettingKelly,
                    )
                  }
                />
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={suggested === null || suggested < g.rules.min}
                onClick={() => suggested !== null && setBet(suggested)}
              >
                {suggested === null
                  ? "Calibration required"
                  : `Use suggested ${money(suggested * 100)}`}
              </Button>
              <span className="micro">
                Actual versus suggested wagers are recorded for discipline
                review.
              </span>
            </div>
          )}
          {g.phase === "insurance" ? (
            <>
              <p>
                Insurance costs {money(g.initialBet / 2)}. Basic strategy
                declines insurance.
              </p>
              <div className="action-buttons">
                <Button onClick={() => s.insure(false)} disabled={s.paused}>
                  Decline insurance
                </Button>
                <Button
                  variant="outline"
                  disabled={s.paused || g.bankroll < g.initialBet / 2}
                  onClick={() => s.insure(true)}
                >
                  Take insurance
                </Button>
                {evaluate(g.hands[0].cards).blackjack &&
                  g.rules.payout === "3:2" && (
                    <Button
                      variant="outline"
                      onClick={() => s.insure(false, true)}
                    >
                      Even money
                    </Button>
                  )}
              </div>
            </>
          ) : ["betting", "settled"].includes(g.phase) ? (
            <div className="wager-controls">
              <div>
                <label htmlFor="wager">YOUR WAGER</label>
                <div className="wager-input">
                  <span>$</span>
                  <input
                    id="wager"
                    type="number"
                    min={legalMinimum(g.rules)}
                    max={Math.min(g.rules.max, Math.floor(g.bankroll / 100))}
                    step={g.rules.betIncrement ?? 1}
                    value={bet}
                    onChange={(e) => setBet(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="chip-options">
                {[10, 25, 50, 100].map((n) => (
                  <button
                    key={n}
                    onClick={() => setBet(n)}
                    className={`chip chip-${n} ${bet === n ? "chip-selected" : ""}`}
                    disabled={
                      n < g.rules.min ||
                      n > g.rules.max ||
                      n * 100 > g.bankroll ||
                      n % (g.rules.betIncrement ?? 1) !== 0
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Button
                className="deal-btn"
                onClick={dealHand}
                disabled={
                  s.paused ||
                  bet * 100 > g.bankroll ||
                  bet < g.rules.min ||
                  bet % (g.rules.betIncrement ?? 1) !== 0 ||
                  bet > g.rules.max
                }
              >
                Deal hand <ChevronRight size={17} />
                <kbd>SPACE</kbd>
              </Button>
            </div>
          ) : (
            <div className="action-buttons">
              {(
                ["hit", "stand", "double", "split", "surrender"] as Action[]
              ).map((a, i) => (
                <Button
                  key={a}
                  variant={a === "hit" ? "default" : "outline"}
                  onClick={() => playAction(a)}
                  disabled={!allowed.includes(a) || s.paused}
                  title={
                    {
                      hit: "Draw another card",
                      stand: "Keep your hand",
                      double: "Double wager, take one card",
                      split: "Separate pair into two hands",
                      surrender: "Return half the original wager",
                    }[a]
                  }
                >
                  {a === "hit" ? (
                    <Plus size={16} />
                  ) : a === "stand" ? (
                    <Flag size={16} />
                  ) : a === "split" ? (
                    <Split size={16} />
                  ) : a === "double" ? (
                    <ArrowDown size={16} />
                  ) : null}
                  {a === "double" ? "Double down" : a}
                  <kbd>{["H", "S", "D", "P", "R"][i]}</kbd>
                </Button>
              ))}
            </div>
          )}
          <div className="table-limits">
            <span>
              Table limits {money(g.rules.min * 100)} –{" "}
              {money(g.rules.max * 100)}
            </span>
            <span>Persistent shoe · Shuffle #{g.shuffles}</span>
          </div>
        </div>
      </section>
      {!s.casino && (
        <aside className="training-rail">
          <section className="rail-card">
            <div className="rail-title">
              <h2>
                <Layers size={17} /> Hi-Lo count
              </h2>
              <button
                className="icon-btn"
                aria-label="Toggle count visibility"
                onClick={() => s.toggle("countVisible")}
              >
                {hide ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="count-pair">
              <div>
                <span>RUNNING COUNT</span>
                <strong>
                  {hide ? "••" : `${g.running >= 0 ? "+" : ""}${g.running}`}
                </strong>
              </div>
              <div>
                <span>TRUE COUNT</span>
                <strong className="gold-text">
                  {hide ? "••" : `${tc.index >= 0 ? "+" : ""}${tc.index}`}
                </strong>
              </div>
            </div>
            <div className="count-facts">
              <div>
                <span>Cards observed</span>
                <b>{hide ? "—" : g.seen}</b>
              </div>
              <div>
                <span>Estimated decks left</span>
                <b>
                  {hide
                    ? "—"
                    : tc.decks.toFixed(g.rules.countPrecision === 0.25 ? 2 : 1)}
                </b>
              </div>
              <div>
                <span>Estimated cards left</span>
                <b>{hide ? "—" : tc.decks * 52}</b>
              </div>
              <div>
                <span>Unseen high cards</span>
                <b>{hide ? "—" : `${(highConcentration * 100).toFixed(1)}%`}</b>
              </div>
              <div>
                <span>Shoe status</span>
                <b>
                  {g.cursor >= Math.floor(g.shoe.length * g.rules.penetration)
                    ? "Shuffle next round"
                    : "In play"}
                </b>
              </div>
              <div>
                <span>Shoe penetration</span>
                <b>{Math.round((g.cursor / g.shoe.length) * 100)}%</b>
              </div>
            </div>
            <div className="progress-track">
              <i style={{ width: `${(g.cursor / g.shoe.length) * 100}%` }} />
              <em style={{ left: `${g.rules.penetration * 100}%` }} />
            </div>
            <p className="micro">
              Nearest {g.rules.countPrecision ?? 0.5} deck ·{" "}
              {g.rules.countRounding ?? "floor"} true count.
              <br />
              Hole card excluded until revealed.
            </p>
            <div className="count-legend">
              <span>
                <b>+1</b> 2–6
              </span>
              <span>
                <b>0</b> 7–9
              </span>
              <span>
                <b>−1</b> 10–A
              </span>
            </div>
          </section>
          <section className="rail-card coach-card">
            <div className="rail-title">
              <h2>
                <Lightbulb size={17} /> Strategy coach
              </h2>
              <button
                className={`switch ${s.coach ? "on" : ""}`}
                aria-label="Toggle strategy coach"
                aria-pressed={s.coach}
                onClick={() => s.toggle("coach")}
              >
                <i />
              </button>
            </div>
            {s.coach ? (
              <>
                {advice && h ? (
                  <>
                    <span className="micro">RECOMMENDED ACTION</span>
                    <div className="advice-action">
                      {advice}
                      <ArrowDown size={18} />
                    </div>
                    <p>{explain(h, g.dealer[0], advice, g.rules)}</p>
                    {countAdvice && countAdvice !== advice && (
                      <p className="notice">
                        Index play: {countAdvice} at TC {tc.index}. Basic
                        strategy shown above.
                      </p>
                    )}
                    <div className="coach-foot">
                      <ShieldCheck size={14} /> Rules-specific guidance
                    </div>
                  </>
                ) : (
                  <>
                    <div className="coach-idle">
                      <ShieldCheck size={25} />
                    </div>
                    <p>
                      {g.phase === "playing"
                        ? "No validated total-dependent chart covers this combination. Use the exact composition coach below; it issues advice only when enumeration finishes."
                        : "A better decision starts with the right information. Deal a hand to see your recommendation."}
                    </p>
                  </>
                )}
                <CompositionCoach />
              </>
            ) : (
              <p>
                Coach hidden. Your decisions are still reviewed for supported
                rules.
              </p>
            )}
          </section>
          <section className="rail-card mini-drill">
            <div className="rail-title">
              <h2>
                <TargetIcon /> Count checkpoint
              </h2>
            </div>
            <p>Test your mental running count.</p>
            <div className="inline-form">
              <input
                aria-label="Your running count"
                type="number"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="e.g. +2"
              />
              <Button size="sm" variant="outline" onClick={check}>
                Check
              </Button>
            </div>
            {feedback && (
              <p aria-live="polite" className="notice">
                {feedback}
              </p>
            )}
          </section>
          {s.coach && h && g.phase === "playing" && (
            <ProbabilityInsights game={g} />
          )}
        </aside>
      )}
    </div>
  );
}
function TargetIcon() {
  return <RotateCcw size={16} />;
}
