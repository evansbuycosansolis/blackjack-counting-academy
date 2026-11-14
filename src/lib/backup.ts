import { Card, hilo, ranks, suits } from "@/engine/cards";
import { Action, Game } from "@/engine/game";
import { validateIndexProfile } from "@/engine/index-profiles";
import { reconstructCounts } from "@/engine/replay";
import { defaultRules, validateRules } from "@/engine/rules";
import {
  allRounds,
  ArchivedRound,
  archiveRound,
  flushStorage,
} from "./storage";
import {
  validateLab,
  validateProgress,
  validateReplayEvents,
  validateRecord,
} from "./validation";
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const integer = (x: unknown) =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const actions: Action[] = ["hit", "stand", "double", "split", "surrender"];
function assert(test: unknown, message: string): asserts test {
  if (!test) throw Error(`Invalid backup: ${message}`);
}
function card(x: unknown): asserts x is Card {
  assert(
    object(x) &&
      typeof x.id === "string" &&
      ranks.includes(x.rank as Card["rank"]) &&
      suits.includes(x.suit as Card["suit"]),
    "card",
  );
}
export function validateGame(value: unknown): Game {
  assert(object(value), "game object");
  const g = structuredClone(value) as unknown as Game;
  assert(object(g.rules), "rules");
  g.rules = { ...defaultRules, ...g.rules };
  validateRules(g.rules);
  for (const k of [
    "hitSoft17",
    "das",
    "resplitAces",
    "hitSplitAces",
    "surrender",
    "insurance",
  ] as const)
    assert(typeof g.rules[k] === "boolean", `rule ${k}`);
  assert(
    ["betting", "insurance", "playing", "settled"].includes(g.phase),
    "phase",
  );
  for (const k of [
    "bankroll",
    "startingBankroll",
    "roundStart",
    "initialBet",
    "insuranceBet",
    "insuranceReturned",
    "round",
    "wagerCount",
    "cursor",
    "seen",
    "shuffles",
    "active",
  ] as const)
    assert(integer(g[k]), k);
  assert(Number.isInteger(g.running), "running count");
  assert(
    typeof g.message === "string" && Number.isFinite(g.tcAtBet),
    "message / wager count",
  );
  assert(
    Array.isArray(g.shoe) && g.shoe.length === 52 * g.rules.decks,
    "shoe size",
  );
  g.shoe.forEach(card);
  const ids = new Map(g.shoe.map((c) => [c.id, c]));
  assert(ids.size === g.shoe.length, "duplicate shoe cards");
  for (const suit of suits)
    for (const rank of ranks)
      assert(
        g.shoe.filter((c) => c.suit === suit && c.rank === rank).length ===
          g.rules.decks,
        "shoe composition",
      );
  assert(g.cursor <= g.shoe.length, "shoe cursor");
  assert(
    Array.isArray(g.dealer) &&
      g.dealer.length <= 30 &&
      Array.isArray(g.hands) &&
      g.hands.length <= g.rules.maxHands &&
      Array.isArray(g.discards),
    "hands/dealer/discards",
  );
  const dealtIds = new Set(g.shoe.slice(0, g.cursor).map((c) => c.id)),
    publicCards = [...g.dealer, ...g.discards];
  for (const h of g.hands) {
    assert(object(h) && Array.isArray(h.cards) && h.cards.length <= 30, "hand");
    h.cards.forEach(card);
    for (const k of [
      "split",
      "splitAces",
      "done",
      "surrendered",
      "doubled",
    ] as const)
      assert(typeof h[k] === "boolean", `hand ${k}`);
    assert(
      integer(h.bet) && integer(h.original) && h.original <= h.bet,
      "hand wager",
    );
    if (h.returned !== undefined) assert(integer(h.returned), "settlement");
    publicCards.push(...h.cards);
  }
  const used = new Set<string>();
  for (const c of publicCards) {
    card(c);
    const source = ids.get(c.id);
    assert(
      source &&
        source.rank === c.rank &&
        source.suit === c.suit &&
        dealtIds.has(c.id),
      "card does not match consumed shoe",
    );
    assert(!used.has(c.id), "duplicate active/discard card");
    used.add(c.id);
  }
  assert(typeof g.revealed === "boolean", "visibility");
  const hidden = !g.revealed && g.dealer.length === 2 ? g.dealer[1] : undefined;
  const exposed = g.shoe.slice(0, g.cursor).filter((c) => c.id !== hidden?.id);
  assert(
    exposed.length === g.seen &&
      exposed.reduce((n, c) => n + hilo(c), 0) === g.running,
    "observable count",
  );
  if (g.phase === "playing" || g.phase === "insurance") {
    assert(g.hands.length > 0 && g.active < g.hands.length, "active hand");
    assert(
      g.roundStart - g.bankroll === g.wagerCount,
      "reserved wager conservation",
    );
    if (g.phase === "playing")
      assert(!g.hands[g.active].done, "finished active hand");
  }
  if (g.phase === "settled") {
    const voided = g.hands.some((h) => h.result === "Void");
    assert(
      g.hands.every((h) => h.done),
      "settled hands",
    );
    assert(
      voided
        ? g.bankroll === g.roundStart
        : g.bankroll ===
            g.roundStart -
              g.wagerCount +
              g.hands.reduce((n, h) => n + (h.returned ?? 0), 0) +
              g.insuranceReturned,
      "settlement conservation",
    );
  }
  assert(Array.isArray(g.decisions) && g.decisions.length <= 200, "decisions");
  for (const d of g.decisions) {
    assert(
      actions.includes(d.action) &&
        (!d.recommended || actions.includes(d.recommended)),
      "decision action",
    );
    assert(Array.isArray(d.cards), "decision cards");
    d.cards.forEach(card);
    card(d.dealer);
  }
  if (g.events) validateReplayEvents(g.events);
  if (g.events)
    assert(
      g.events.length <= 500 &&
        reconstructCounts(g.events).every((x) => x.valid),
      "event count reconstruction",
    );
  return g;
}
export interface Backup {
  format: "blackjack-academy";
  version: 2;
  created: string;
  game: Record<string, unknown>;
  lab: Record<string, unknown>;
  rounds: ArchivedRound[];
}
export async function makeBackup(
  game: Record<string, unknown>,
  lab: Record<string, unknown>,
): Promise<Backup> {
  await flushStorage();
  return {
    format: "blackjack-academy",
    version: 2,
    created: new Date().toISOString(),
    game: JSON.parse(JSON.stringify(game)),
    lab: JSON.parse(JSON.stringify(lab)),
    rounds: await allRounds(),
  };
}
export function validateBackup(input: unknown): Backup {
  assert(
    object(input) &&
      input.format === "blackjack-academy" &&
      input.version === 2,
    "format/version",
  );
  assert(
    object(input.game) &&
      object(input.lab) &&
      Array.isArray(input.rounds) &&
      input.rounds.length <= 100000,
    "state envelope",
  );
  const data = structuredClone(input) as unknown as Backup;
  validateProgress(data.game);
  validateLab(data.lab);
  assert(
    data.game.game !== null && data.game.game !== undefined,
    "initialized session",
  );
  data.game.game = validateGame(data.game.game);
  assert(
    Array.isArray(data.game.history) && data.game.history.length <= 5000,
    "history",
  );
  assert(
    Array.isArray(data.game.indexProfiles) &&
      data.game.indexProfiles.length <= 100,
    "index profiles",
  );
  for (const p of data.game.indexProfiles) validateIndexProfile(p);
  assert(
    Array.isArray(data.lab.ramps) && data.lab.ramps.length <= 1000,
    "betting ramps",
  );
  for (const r of data.rounds) {
    assert(object(r), "archived round");
    validateRecord(r.record);
    validateReplayEvents(r.events);
    assert(
      r.id === r.record.id && r.session === r.record.session,
      "archive identity",
    );
    assert(
      object(r) &&
        typeof r.id === "string" &&
        Array.isArray(r.events) &&
        r.events.length <= 500,
      "archived round",
    );
    assert(
      reconstructCounts(r.events).every((x) => x.valid),
      "archived counts",
    );
    assert(
      object(r.record) &&
        Array.isArray(r.record.decisions) &&
        Array.isArray(r.record.results) &&
        integer(r.record.bankroll) &&
        typeof r.record.profit === "number" &&
        Number.isSafeInteger(r.record.profit),
      "round record",
    );
  }
  return data;
}
export async function restoreRoundArchive(rounds: ArchivedRound[]) {
  for (const r of rounds) await archiveRound(r);
  await flushStorage();
}
