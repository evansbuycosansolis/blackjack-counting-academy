"use client";
import { Rules, presets, ruleSummary } from "@/engine/rules";
import { strategyScope } from "@/engine/strategy";
import { useGame } from "@/stores/game-store";
import { Save } from "lucide-react";
import { useState } from "react";
import { BackupControls } from "./backup-controls";
import { Button } from "./ui/button";
export function SettingsPanel() {
  const s = useGame(),
    [r, setR] = useState<Rules>({ ...s.rules }),
    [bankroll, setBankroll] = useState(1000),
    [name, setName] = useState(""),
    [saved, setSaved] = useState("");
  const field = <K extends keyof Rules>(key: K, v: Rules[K]) =>
    setR({ ...r, [key]: v });
  const selects: {
    key: keyof Rules;
    label: string;
    options: [string, string][];
  }[] = [
    {
      key: "countPrecision",
      label: "Deck estimation precision",
      options: [
        ["0.25", "Quarter deck"],
        ["0.5", "Half deck"],
        ["1", "Whole deck"],
      ],
    },
    {
      key: "countRounding",
      label: "True-count index rounding",
      options: [
        ["floor", "Floor (toward −∞)"],
        ["truncate", "Truncate (toward zero)"],
        ["round", "Nearest integer"],
      ],
    },
    {
      key: "decks",
      label: "Number of decks",
      options: [1, 2, 4, 6, 8].map((n) => [String(n), String(n)]),
    },
    {
      key: "payout",
      label: "Blackjack payout",
      options: [
        ["3:2", "3:2"],
        ["6:5", "6:5"],
      ],
    },
    {
      key: "double",
      label: "Double restrictions",
      options: [
        ["any", "Any two cards"],
        ["9-11", "Hard 9–11"],
        ["10-11", "Hard 10–11"],
      ],
    },
    {
      key: "maxHands",
      label: "Maximum split hands",
      options: [
        ["2", "2 (no resplits)"],
        ["3", "3"],
        ["4", "4"],
      ],
    },
    {
      key: "holeCard",
      label: "Dealer hole card",
      options: [
        ["peek", "US hole card + peek"],
        ["no-peek", "US hole card, no peek"],
        ["european", "European no hole card"],
      ],
    },
    {
      key: "dealerBlackjackLoss",
      label: "Delayed dealer blackjack",
      options: [
        ["all", "Lose all unresolved wagers"],
        ["original", "Original bet only (bust wagers lost)"],
      ],
    },
  ];
  const toggles: { key: keyof Rules; label: string; note?: string }[] = [
    { key: "hitSoft17", label: "Dealer hits soft 17" },
    { key: "das", label: "Double after split" },
    { key: "resplitAces", label: "Resplit Aces" },
    { key: "hitSplitAces", label: "Hit split Aces" },
    {
      key: "surrender",
      label: "Late surrender",
      note: "Against Ace/10, available after US peek only.",
    },
    { key: "insurance", label: "Offer insurance" },
  ];
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow gold">MAKE THE TABLE YOUR OWN</div>
            <h2>Casino rules & session setup</h2>
            <p>
              Applying rules starts a new shoe and virtual bankroll. Saved
              history is retained.
            </p>
          </div>
        </div>
        <label className="compact-label">
          Load a preset
          <select
            defaultValue=""
            onChange={(e) => {
              const all = { ...presets, ...s.presets };
              if (all[e.target.value]) {
                setR({ ...all[e.target.value] });
                setSaved("");
              }
            }}
          >
            <option value="" disabled>
              Choose a rule preset
            </option>
            {Object.keys({ ...presets, ...s.presets }).map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="notice">
          {ruleSummary(r)} · Double {r.double} · Up to {r.maxHands} hands ·{" "}
          {r.surrender ? "Late surrender" : "No surrender"} ·{" "}
          {r.resplitAces ? "Resplit Aces" : "No resplit Aces"} ·{" "}
          {r.hitSplitAces ? "Hit split Aces" : "One card to split Aces"} ·
          Delayed blackjack: {r.dealerBlackjackLoss} wagers.
        </div>
        <div className="form-grid">
          {selects.map((f) => (
            <label key={f.key}>
              {f.label}
              <select
                value={String(r[f.key])}
                onChange={(e) =>
                  setR({
                    ...r,
                    [f.key]: ["decks", "maxHands", "countPrecision"].includes(
                      f.key,
                    )
                      ? Number(e.target.value)
                      : e.target.value,
                  })
                }
              >
                {f.options.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Minimum wager
            <input
              type="number"
              min={1}
              step={1}
              value={r.min}
              onChange={(e) => field("min", Number(e.target.value))}
            />
          </label>
          <label>
            Bet increment
            <input
              aria-label="Bet increment"
              type="number"
              min={1}
              step={1}
              value={r.betIncrement ?? 1}
              onChange={(e) => field("betIncrement", Number(e.target.value))}
            />
          </label>
          <label>
            Maximum wager
            <input
              type="number"
              min={r.min}
              step={1}
              value={r.max}
              onChange={(e) => field("max", Number(e.target.value))}
            />
          </label>
          <label>
            Starting virtual bankroll
            <input
              type="number"
              min={1}
              step={1}
              value={bankroll}
              onChange={(e) => setBankroll(Number(e.target.value))}
            />
          </label>
          <label>
            Cut-card penetration · {Math.round(r.penetration * 100)}%
            <input
              type="range"
              min={50}
              max={90}
              value={Math.round(r.penetration * 100)}
              onChange={(e) =>
                field("penetration", Number(e.target.value) / 100)
              }
            />
          </label>
        </div>
        <div className="toggle-grid">
          {toggles.map((t) => (
            <label className="checkbox-label" key={t.key}>
              <input
                type="checkbox"
                checked={Boolean(r[t.key])}
                onChange={(e) => setR({ ...r, [t.key]: e.target.checked })}
              />
              <span>
                {t.label}
                {t.note && <small>{t.note}</small>}
              </span>
            </label>
          ))}
        </div>
        <div className="form-row spaced">
          <Button
            onClick={() => {
              s.configure(r, bankroll);
              setSaved("");
            }}
          >
            Apply rules & start new session
          </Button>
          <input
            aria-label="Custom preset name"
            value={name}
            placeholder="Name your rule preset"
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!name.trim()}
            onClick={() => {
              s.savePreset(name.trim(), r);
              setSaved(`Saved preset: ${name.trim()}`);
            }}
          >
            <Save size={15} /> Save preset
          </Button>
        </div>
        {saved && (
          <p className="notice" role="status">
            {saved}
          </p>
        )}
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>Practice preferences</h2>
          <label className="compact-label">
            Difficulty preset
            <select
              defaultValue="Beginner"
              onChange={(e) => {
                const n = e.target.selectedIndex;
                s.setSpeed([0.5, 0.25, 0.12, 0][n]);
                if (s.countVisible !== (n === 0)) s.toggle("countVisible");
                if (s.coach !== n < 2) s.toggle("coach");
                if (s.casino !== (n === 3)) s.toggle("casino");
              }}
            >
              {["Beginner", "Intermediate", "Advanced", "Expert"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <div className="toggle-grid">
            {(
              [
                { key: "countVisible", label: "Show counting aids" },
                { key: "coach", label: "Show strategy coach" },
                { key: "sound", label: "Sound effects" },
                { key: "light", label: "Light interface" },
              ] as const
            ).map((t) => (
              <label key={t.key} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={s[t.key]}
                  onChange={() => s.toggle(t.key)}
                />
                {t.label}
              </label>
            ))}
          </div>
          <label className="compact-label">
            Card animation · {s.speed.toFixed(2)}s
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={s.speed}
              onChange={(e) => s.setSpeed(Number(e.target.value))}
            />
          </label>
          <label className="compact-label">
            Practice goal (hands)
            <input
              type="number"
              value={s.goal}
              min={1}
              max={10000}
              onChange={(e) =>
                s.setGoal(Math.max(1, Math.min(10000, Number(e.target.value))))
              }
            />
          </label>
          <p className="micro">
            Keyboard: H hit · S stand · D double · P split · R surrender · Space
            deal. Shortcuts pause while you type.
          </p>
        </section>
        <section className="panel">
          <h2>Mathematical conventions</h2>
          <p>{strategyScope}</p>
          <p>
            Deck estimation rounds undealt cards to the nearest{" "}
            {r.countPrecision ?? 0.5} deck, with that same minimum. True-count
            index conversion uses {r.countRounding ?? "floor"} rounding. The cut
            card triggers a shuffle between rounds.
          </p>
          <p>
            Wagers use whole virtual chips. Internal cents give exact 3:2, 6:5,
            surrender and insurance settlements. Split 21 pays even money. No
            early surrender.
          </p>
          <p>
            Delayed dealer blackjack follows the selected all-bets or
            original-bet-only policy; already busted hands lose their full
            wagers. No-hole-card insurance is resolved when the dealer receives
            a second card.
          </p>
          <p className="micro">
            Local storage retains the last 5,000 rounds and your current
            session. Export regularly for longer study. No accounts, servers or
            real-money features.
          </p>
          <a
            href="https://wizardofodds.com/games/blackjack/strategy/4-decks/"
            target="_blank"
            rel="noreferrer"
          >
            Basic strategy reference ↗
          </a>
        </section>
      </div>
      <BackupControls />
    </>
  );
}
