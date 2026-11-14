import { validateRamp } from "@/engine/betting";
import { Card, ranks, suits } from "@/engine/cards";
import { validateIndexProfile } from "@/engine/index-profiles";
import { defaultRules, validateRules } from "@/engine/rules";
import type { RoundRecord } from "./analytics";
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function ensure(v: unknown, message: string): asserts v {
  if (!v) throw Error("Invalid saved progress: " + message);
}
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v),
  uint = (v: unknown) =>
    finite(v) && Number.isSafeInteger(v) && (v as number) >= 0;
function cards(v: unknown) {
  ensure(Array.isArray(v) && v.length <= 30, "card list");
  for (const c of v)
    ensure(
      obj(c) &&
        typeof c.id === "string" &&
        ranks.includes(c.rank as Card["rank"]) &&
        suits.includes(c.suit as Card["suit"]),
      "card",
    );
}
export function validateRecord(v: unknown): asserts v is RoundRecord {
  ensure(
    obj(v) &&
      typeof v.id === "string" &&
      typeof v.session === "string" &&
      typeof v.date === "string" &&
      Number.isFinite(Date.parse(v.date)),
    "round identity",
  );
  ensure(
    uint(v.round) &&
      uint(v.bankroll) &&
      uint(v.wager) &&
      uint(v.duration) &&
      finite(v.profit) &&
      Number.isSafeInteger(v.profit) &&
      finite(v.tc),
    "round numbers",
  );
  ensure(obj(v.rules), "round rules");
  validateRules({ ...defaultRules, ...v.rules });
  ensure(
    Array.isArray(v.results) &&
      v.results.length <= 4 &&
      v.results.every((x) => typeof x === "string"),
    "round results",
  );
  ensure(Array.isArray(v.decisions) && v.decisions.length <= 200, "decisions");
  for (const d of v.decisions) {
    ensure(
      obj(d) &&
        ["hit", "stand", "double", "split", "surrender"].includes(
          String(d.action),
        ),
      "decision",
    );
    cards(d.cards);
    cards([d.dealer]);
  }
  if (v.betAssessment !== undefined) {
    const b = v.betAssessment;
    ensure(
      obj(b) &&
        finite(b.actual) &&
        finite(b.recommended) &&
        typeof b.correct === "boolean" &&
        finite(b.tc) &&
        typeof b.method === "string",
      "bet assessment",
    );
  }
}
export function validateProgress(v: unknown) {
  ensure(obj(v), "state");
  if (v.history !== undefined) {
    ensure(Array.isArray(v.history) && v.history.length <= 5000, "history");
    v.history.forEach(validateRecord);
  }
  if (v.ramp !== undefined) {
    ensure(Array.isArray(v.ramp) && validateRamp(v.ramp), "ramp");
  }
  if (v.checks !== undefined) {
    ensure(Array.isArray(v.checks) && v.checks.length <= 5000, "checks");
    for (const c of v.checks)
      ensure(
        obj(c) &&
          typeof c.correct === "boolean" &&
          [
            "counting",
            "strategy",
            "deviation",
            "insurance",
            "memory",
            "threshold",
          ].includes(String(c.kind)) &&
          typeof c.date === "string" &&
          (c.error === undefined || finite(c.error)),
        "checkpoint",
      );
  }
  for (const k of [
    "coach",
    "countVisible",
    "casino",
    "light",
    "sound",
    "paused",
    "autoDifficulty",
  ])
    if (v[k] !== undefined) ensure(typeof v[k] === "boolean", k);
  for (const k of ["session", "activeIndexId"])
    if (v[k] !== undefined) ensure(typeof v[k] === "string", k);
  if (v.goal !== undefined)
    ensure(
      uint(v.goal) && (v.goal as number) >= 1 && (v.goal as number) <= 10000,
      "goal",
    );
  if (v.speed !== undefined)
    ensure(
      finite(v.speed) && (v.speed as number) >= 0 && (v.speed as number) <= 0.8,
      "speed",
    );
  if (v.bettingMode !== undefined)
    ensure(
      ["manual", "flat", "ramp", "kelly"].includes(String(v.bettingMode)),
      "betting mode",
    );
  if (v.bettingUnit !== undefined)
    ensure(
      uint(v.bettingUnit) && (v.bettingUnit as number) > 0,
      "betting unit",
    );
  if (v.bettingKelly !== undefined)
    ensure(
      finite(v.bettingKelly) &&
        (v.bettingKelly as number) > 0 &&
        (v.bettingKelly as number) <= 1,
      "Kelly fraction",
    );
  if (v.completed !== undefined)
    ensure(
      Array.isArray(v.completed) && v.completed.every((x) => uint(x) && x < 7),
      "lesson completion",
    );
  if (v.indexProfiles !== undefined) {
    ensure(
      Array.isArray(v.indexProfiles) && v.indexProfiles.length <= 100,
      "index profiles",
    );
    v.indexProfiles.forEach((p) => {
      ensure(
        obj(p) && p.validated === false,
        "custom profile cannot claim source validation",
      );
      validateIndexProfile(
        p as unknown as Parameters<typeof validateIndexProfile>[0],
      );
    });
  }
  if (v.mastery !== undefined) {
    ensure(
      obj(v.mastery) &&
        finite(v.mastery.accuracy) &&
        (v.mastery.accuracy as number) >= 0.5 &&
        (v.mastery.accuracy as number) <= 1 &&
        uint(v.mastery.attempts) &&
        (v.mastery.attempts as number) >= 5 &&
        (v.mastery.attempts as number) <= 100 &&
        finite(v.mastery.cardsPerMinute) &&
        (v.mastery.cardsPerMinute as number) >= 10,
      "mastery settings",
    );
  }
  if (v.timedRecords !== undefined) {
    ensure(
      Array.isArray(v.timedRecords) && v.timedRecords.length <= 1000,
      "timed records",
    );
    for (const r of v.timedRecords)
      ensure(
        obj(r) &&
          typeof r.id === "string" &&
          typeof r.mode === "string" &&
          typeof r.date === "string" &&
          uint(r.cards) &&
          finite(r.activeMs) &&
          (r.activeMs as number) > 0 &&
          finite(r.cardsPerMinute) &&
          typeof r.correct === "boolean",
        "timed result",
      );
  }
  if (v.presets !== undefined) {
    ensure(obj(v.presets), "presets");
    for (const r of Object.values(v.presets)) {
      ensure(obj(r), "preset");
      validateRules({ ...defaultRules, ...r });
    }
  }
  if (v.drills !== undefined) {
    ensure(obj(v.drills), "drills");
    for (const k of ["correct", "total", "tcError", "tcTotal"])
      ensure(
        finite(v.drills[k]) && (v.drills[k] as number) >= 0,
        "drill metrics",
      );
  }
  return true;
}
export function validateLab(v: unknown) {
  ensure(obj(v), "laboratory");
  ensure(Array.isArray(v.ramps) && v.ramps.length <= 1000, "named ramps");
  for (const r of v.ramps)
    ensure(
      obj(r) &&
        typeof r.id === "string" &&
        typeof r.name === "string" &&
        Array.isArray(r.rows) &&
        validateRamp(r.rows),
      "named ramp",
    );
  for (const key of ["runs", "riskRuns", "models"])
    if (v[key] !== undefined)
      ensure(
        Array.isArray(v[key]) &&
          (v[key] as unknown[]).length <= (key === "riskRuns" ? 5 : 10),
        key,
      );
  if (Array.isArray(v.runs))
    for (const r of v.runs)
      ensure(
        obj(r) &&
          typeof r.id === "string" &&
          obj(r.result) &&
          uint(r.result.hands) &&
          finite(r.result.profit) &&
          finite(r.result.maxDrawdown) &&
          finite(r.result.seed) &&
          finite(r.result.averageBet) &&
          finite(r.result.maxBet) &&
          finite(r.result.averageTC) &&
          Array.isArray(r.result.ci95) &&
          r.result.ci95.length === 2 &&
          obj(r.result.config) &&
          Array.isArray(r.result.points) &&
          r.result.points.length <= 1002,
        "simulation run",
      );
  if (Array.isArray(v.models))
    for (const m of v.models) {
      ensure(
        obj(m) &&
          typeof m.rulesKey === "string" &&
          typeof m.policy === "string" &&
          Array.isArray(m.bins) &&
          m.bins.length <= 21,
        "calibration",
      );
      for (const b of m.bins)
        ensure(
          obj(b) &&
            uint(b.samples) &&
            uint(b.shoes) &&
            finite(b.mean) &&
            finite(b.kellyFraction) &&
            (b.kellyFraction as number) >= 0 &&
            (b.kellyFraction as number) <= 1 &&
            Array.isArray(b.outcomes) &&
            b.outcomes.length <= 1000,
          "calibration bin",
        );
    }
  return true;
}
export function validateReplayEvents(value: unknown) {
  ensure(Array.isArray(value) && value.length <= 500, "event history");
  for (let i = 0; i < value.length; i++) {
    const e = value[i];
    ensure(
      obj(e) &&
        e.step === i &&
        typeof e.kind === "string" &&
        Number.isInteger(e.running) &&
        Number.isInteger(e.trueCount) &&
        uint(e.remaining) &&
        uint(e.seen) &&
        uint(e.shuffles),
      "event metadata",
    );
    if (e.card !== undefined) cards([e.card]);
    if (e.visible !== undefined)
      ensure(typeof e.visible === "boolean", "event visibility");
    if (e.frame !== undefined) {
      const f = e.frame;
      ensure(
        obj(f) &&
          ["betting", "playing", "insurance", "settled"].includes(
            String(f.phase),
          ) &&
          typeof f.revealed === "boolean" &&
          Array.isArray(f.hands) &&
          f.hands.length <= 4 &&
          uint(f.bankroll) &&
          typeof f.message === "string",
        "replay frame",
      );
      cards(f.dealer);
      for (const h of f.hands) {
        ensure(
          obj(h) &&
            uint(h.bet) &&
            typeof h.split === "boolean" &&
            typeof h.doubled === "boolean" &&
            (h.result === undefined || typeof h.result === "string"),
          "replay hand",
        );
        cards(h.cards);
      }
    }
  }
  return true;
}
