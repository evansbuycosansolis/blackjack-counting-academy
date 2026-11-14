import { expect, it } from "vitest";
import { Game, newGame, deal, act, legalActions } from "@/engine/game";
import { ActionSampler, exactActionStudy } from "@/engine/analysis";
import { Rules, defaultRules } from "@/engine/rules";
import { Rank, value, seededRandom } from "@/engine/cards";
function permutations<T>(xs: T[]): T[][] {
  return xs.length < 2
    ? [xs]
    : xs.flatMap((x, i) =>
        permutations(xs.filter((_, j) => i !== j)).map((rest) => [x, ...rest]),
      );
}
function visibleKey(g: Game) {
  return JSON.stringify([
    g.phase,
    g.active,
    g.bankroll,
    g.hands.map((h) => [
      h.cards.map(value),
      h.bet,
      h.original,
      h.split,
      h.splitAces,
      h.done,
      h.surrendered,
    ]),
    value(g.dealer[0]),
  ]);
}
function oracle(worlds: Game[]): number {
  if (worlds.every((g) => g.phase === "settled"))
    return (
      worlds.reduce(
        (n, g) => n + (g.bankroll - g.roundStart) / g.initialBet,
        0,
      ) / worlds.length
    );
  const groups = new Map<string, Game[]>();
  let terminal = 0;
  for (const g of worlds) {
    if (g.phase === "settled") {
      terminal += (g.bankroll - g.roundStart) / g.initialBet;
      continue;
    }
    const key = visibleKey(g),
      group = groups.get(key) ?? [];
    group.push(g);
    groups.set(key, group);
  }
  let expected = terminal / worlds.length;
  for (const group of groups.values()) {
    let best = -Infinity;
    for (const action of legalActions(group[0]))
      best = Math.max(best, oracle(group.map((g) => act(g, action))));
    expected += (group.length / worlds.length) * best;
  }
  return expected;
}
for (const overrides of [
  { maxHands: 2, das: false },
  { maxHands: 3, das: true },
  { maxHands: 4, resplitAces: true },
  { maxHands: 4, hitSplitAces: true, resplitAces: true },
  {
    maxHands: 2,
    das: true,
    double: "10-11",
    holeCard: "european",
    dealerBlackjackLoss: "original",
  },
  {
    maxHands: 3,
    hitSplitAces: true,
    resplitAces: true,
    holeCard: "european",
    dealerBlackjackLoss: "all",
  },
  {
    maxHands: 2,
    das: true,
    double: "10-11",
    holeCard: "no-peek",
    dealerBlackjackLoss: "original",
  },
  {
    maxHands: 3,
    das: true,
    double: "9-11",
    holeCard: "no-peek",
    dealerBlackjackLoss: "all",
  },
] as Partial<Rules>[])
  it(`full observable-decision-tree oracle validates correlated splits ${JSON.stringify(overrides)}`, () => {
    const aces = !!overrides.resplitAces,
      player: Rank = aces ? "A" : "8";
    let g = newGame(
      { ...defaultRules, ...overrides, insurance: false },
      100000,
      seededRandom(1),
    );
    const rest = [...g.shoe],
      take = (r: Rank) =>
        rest.splice(
          rest.findIndex((c) => c.rank === r),
          1,
        )[0],
      visible = [player, "6", player].map((r) => take(r as Rank)),
      unknown = (
        aces
          ? ["A", "2", "3", "9", "10", "10"]
          : ["2", "3", "5", "9", "10", "10"]
      ).map((r) => take(r as Rank));
    g.shoe = [...visible, ...unknown];
    g = deal(g, 10);
    const study = exactActionStudy(g, 1000000),
      exact = study.result,
      worlds = permutations(unknown).map((p) => ({
        ...structuredClone(g),
        shoe: [...visible, ...p],
        dealer:
          g.rules.holeCard === "european" ? [visible[1]] : [visible[1], p[0]],
      }));
    for (const action of legalActions(g)) {
      const expected = oracle(worlds.map((w) => act(w, action)));
      expect(exact.actions.find((x) => x.action === action)!.ev).toBeCloseTo(
        expected,
        10,
      );
    }
    const snapshot = structuredClone(g);
    const sampler = new ActionSampler(
      g,
      4000,
      20261113,
      study.continuation,
      true,
    );
    while (!sampler.step(100)) {
      /* bounded independent trials */
    }
    const observed = sampler.finish();
    for (const row of observed.actions) {
      const theoretical = exact.actions.find(
        (x) => x.action === row.action,
      )!.ev;
      // A conservative deterministic regression envelope, not a claimed 95% pass rate.
      expect(Math.abs(row.ev - theoretical)).toBeLessThan(
        0.025 + 3 * (row.ci95[1] - row.ev),
      );
    }
    expect(g).toEqual(snapshot);
    expect(sampler.curve.at(-1)?.samples).toBe(4000);
  }, 30000);
