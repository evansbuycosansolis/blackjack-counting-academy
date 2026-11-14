import { defaultRamp, wager } from "@/engine/betting";
import {
  Card,
  createShoe,
  evaluate,
  hilo,
  Rank,
  seededRandom,
  trueCount,
} from "@/engine/cards";
import { act, deal, insurance, legalActions, newGame } from "@/engine/game";
import {
  blackjackProbability,
  hitBustProbability,
  observablePool,
} from "@/engine/probabilities";
import { defaultRules, Rules } from "@/engine/rules";
import { SimulationConfig, Simulator } from "@/engine/simulation";
import {
  adjusted,
  deviationsSupported,
  recommend,
  strategySupported,
} from "@/engine/strategy";
import { describe, expect, it } from "vitest";
const cards = (...r: Rank[]): Card[] =>
  r.map((rank, i) => ({ rank, suit: "♠", id: String(i) }));
function rig(
  prefix: Rank[],
  overrides: Partial<Rules> = {},
  bankroll = 100000,
) {
  const g = newGame(
    { ...defaultRules, ...overrides },
    bankroll,
    seededRandom(1),
  );
  const remaining = [...g.shoe];
  const top = prefix.map((rank) => {
    const i = remaining.findIndex((c) => c.rank === rank);
    return remaining.splice(i, 1)[0];
  });
  g.shoe = [...top, ...remaining];
  return g;
}
function start(
  prefix: Rank[],
  overrides: Partial<Rules> = {},
  bankroll = 100000,
) {
  return deal(rig(prefix, overrides, bankroll), 10);
}
describe("cards, shoe and count", () => {
  for (const decks of [1, 2, 4, 6, 8])
    it(`${decks}-deck exact composition`, () => {
      const shoe = createShoe(decks, seededRandom(42));
      expect(shoe).toHaveLength(decks * 52);
      expect(new Set(shoe.map((c) => c.id)).size).toBe(decks * 52);
      expect(shoe.filter((c) => c.rank === "A")).toHaveLength(decks * 4);
      expect(shoe.reduce((a, c) => a + hilo(c), 0)).toBe(0);
    });
  it("seeded Fisher–Yates is reproducible", () =>
    expect(createShoe(6, seededRandom(7))).toEqual(
      createShoe(6, seededRandom(7)),
    ));
  it("evaluates soft and multiple aces", () => {
    expect(evaluate(cards("A", "7"))).toMatchObject({ total: 18, soft: true });
    expect(evaluate(cards("A", "7", "9"))).toMatchObject({
      total: 17,
      soft: false,
    });
    expect(evaluate(cards("A", "A", "9"))).toMatchObject({
      total: 21,
      soft: true,
    });
    expect(evaluate(cards("A", "A", "A", "9"))).toMatchObject({
      total: 12,
      soft: false,
    });
  });
  it("split 21 is never a natural", () => {
    expect(evaluate(cards("A", "K")).blackjack).toBe(true);
    expect(evaluate(cards("A", "K"), true).blackjack).toBe(false);
  });
  it("true count rounds deck estimation and floors negatives", () => {
    expect(trueCount(-2, 156)).toMatchObject({ decks: 3, index: -1 });
    expect(trueCount(-2, 156, 0.5, "truncate").index).toBe(-0);
    expect(trueCount(3, 1).decks).toBe(0.5);
  });
  it("hole card excluded until exposed", () => {
    let g = start(["2", "7", "4", "K", "10"]);
    expect(g.running).toBe(2);
    expect(g.seen).toBe(3);
    g = act(g, "stand");
    expect(g.running).toBe(1);
    expect(g.seen).toBe(4);
  });
  it("shoe and running count persist between rounds", () => {
    let g = start(["10", "10", "8", "7", "2", "3", "4", "5"]);
    g = act(g, "stand");
    const cursor = g.cursor,
      rc = g.running;
    const next = deal(g, 10);
    expect(next.cursor).toBe(cursor + 4);
    expect(next.shuffles).toBe(1);
    expect(next.running).toBe(
      rc + g.shoe.slice(cursor, cursor + 3).reduce((n, c) => n + hilo(c), 0),
    );
    expect(next.discards.length).toBe(4);
  });
  it("cut crossing does not reshuffle within a round", () => {
    let g = rig(["10", "10", "8", "7"]);
    g.cursor = Math.floor(g.shoe.length * 0.75) - 2;
    g.running = 5;
    g = deal(g, 10);
    expect(g.shuffles).toBe(1);
    if (g.phase === "playing") g = act(g, "stand");
    g = deal(g, 10, seededRandom(3));
    expect(g.shuffles).toBe(2);
    expect(g.discards).toHaveLength(0);
  });
});
describe("settlement and legal transitions", () => {
  it("natural pays 3:2 exactly", () => {
    const g = start(["A", "9", "K", "8"]);
    expect(g.phase).toBe("settled");
    expect(g.bankroll).toBe(101500);
  });
  it("natural pays 6:5 exactly with an odd wager", () => {
    const g = deal(rig(["A", "9", "K", "8"], { payout: "6:5" }), 11);
    expect(g.bankroll).toBe(101320);
  });
  it("dealer natural wins immediately after peek", () => {
    const g = start(["9", "K", "8", "A"]);
    expect(g.bankroll).toBe(99000);
    expect(g.revealed).toBe(true);
  });
  it("mutual blackjack pushes", () => {
    let g = start(["A", "A", "K", "K"]);
    g = insurance(g, false);
    expect(g.bankroll).toBe(100000);
  });
  it("insurance independently pays 2:1", () => {
    let g = start(["9", "A", "8", "K"]);
    g = insurance(g, true);
    expect(g.bankroll).toBe(100000);
    expect(g.insuranceReturned).toBe(1500);
  });
  it("insurance loses while main hand wins", () => {
    let g = start(["A", "A", "K", "8"]);
    g = insurance(g, true);
    expect(g.bankroll).toBe(101000);
  });
  it("even money guarantees one bet", () => {
    let g = start(["A", "A", "K", "K"]);
    g = insurance(g, false, true);
    expect(g.bankroll).toBe(101000);
    expect(g.hands[0].result).toBe("Even money");
  });
  it("does not offer even money at 6:5", () => {
    const g = start(["A", "A", "K", "8"], { payout: "6:5" });
    expect(() => insurance(g, false, true)).toThrow();
  });
  it("insurance requires available bankroll", () => {
    const g = start(["9", "A", "8", "K"], {}, 1000);
    expect(() => insurance(g, true)).toThrow("Insufficient");
  });
  it("double takes exactly one card and settles doubled wager", () => {
    const g = act(start(["5", "6", "6", "10", "K", "10"]), "double");
    expect(g.hands[0].cards).toHaveLength(3);
    expect(g.hands[0].bet).toBe(2000);
    expect(g.bankroll).toBe(102000);
  });
  it("surrender returns half once", () => {
    const g = act(start(["10", "10", "6", "7"]), "surrender");
    expect(g.bankroll).toBe(99500);
    expect(() => act(g, "surrender")).toThrow();
  });
  it("push refunds initial bet", () => {
    const g = act(start(["10", "10", "8", "8"]), "stand");
    expect(g.bankroll).toBe(100000);
  });
  it("bust loses even when dealer busts", () => {
    const g = act(start(["10", "6", "6", "10", "K"]), "hit");
    expect(g.bankroll).toBe(99000);
    expect(g.hands[0].result).toBe("Bust");
  });
  it("S17 stands while H17 draws", () => {
    let a = start(["10", "A", "8", "6", "2"]);
    a = insurance(a, false);
    a = act(a, "stand");
    expect(a.dealer).toHaveLength(2);
    let b = start(["10", "A", "8", "6", "2"], { hitSoft17: true });
    b = insurance(b, false);
    b = act(b, "stand");
    expect(b.dealer).toHaveLength(3);
    expect(b.bankroll).toBe(99000);
  });
  it("split Aces take one card, 21 pays even money", () => {
    const g = act(start(["A", "9", "A", "8", "K", "Q"]), "split");
    expect(g.phase).toBe("settled");
    expect(g.bankroll).toBe(102000);
    expect(g.hands.every((h) => h.result === "Win")).toBe(true);
  });
  it("resplit Aces remain actionable when enabled", () => {
    const g = act(
      start(["A", "9", "A", "8", "A", "7"], { resplitAces: true }),
      "split",
    );
    expect(g.phase).toBe("playing");
    expect(legalActions(g)).toEqual(["stand", "split"]);
  });
  it("ordinary resplits cap at maximum hands", () => {
    let g = act(
      start(["8", "6", "8", "10", "8", "8", "8", "8"], { maxHands: 3 }),
      "split",
    );
    g = act(g, "split");
    expect(g.hands).toHaveLength(3);
    expect(legalActions(g)).not.toContain("split");
  });
  it("DAS and bankroll restrictions", () => {
    const g = act(
      start(["5", "6", "5", "10", "6", "6"], { das: false }),
      "split",
    );
    expect(legalActions(g)).not.toContain("double");
    const poor = start(["5", "6", "6", "10"], {}, 1000);
    expect(legalActions(poor)).not.toContain("double");
  });
  it("double restrictions reject soft totals", () => {
    const g = start(["A", "6", "9", "10"], { double: "10-11" });
    expect(legalActions(g)).not.toContain("double");
  });
  it("cannot overbet, underbet or use fractional initial wager", () => {
    const g = rig([]);
    for (const b of [0, 9, 501, 1001, 10.5, NaN])
      expect(() => deal(g, b)).toThrow();
  });
  it("pure transitions do not mutate input", () => {
    const g = rig(["10", "6", "8", "10"]);
    const snapshot = structuredClone(g);
    const n = deal(g, 10);
    expect(g).toEqual(snapshot);
    const x = structuredClone(n);
    act(n, "stand");
    expect(n).toEqual(x);
  });
  it("repeated settlement actions cannot pay twice", () => {
    const g = start(["A", "9", "K", "8"]);
    expect(() => act(g, "stand")).toThrow();
    expect(() => insurance(g, true)).toThrow();
  });
  for (const policy of ["all", "original"] as const)
    it(`European delayed blackjack: ${policy}`, () => {
      let g = start(["5", "A", "6", "10", "K"], {
        holeCard: "european",
        dealerBlackjackLoss: policy,
      });
      g = insurance(g, false);
      g = act(g, "double");
      expect(g.bankroll).toBe(policy === "all" ? 98000 : 99000);
      expect(g.dealer).toHaveLength(2);
    });
  it("late surrender unavailable before delayed blackjack excluded", () => {
    let g = start(["10", "A", "6", "8"], { holeCard: "no-peek" });
    g = insurance(g, false);
    expect(legalActions(g)).not.toContain("surrender");
  });
  it("exhaustion voids a round and refunds all wagers", () => {
    let g = start(["5", "6", "6", "10"]);
    g.shoe = g.shoe.slice(0, 4);
    g = act(g, "double");
    expect(g.phase).toBe("settled");
    expect(g.bankroll).toBe(100000);
    expect(g.hands[0].result).toBe("Void");
  });
});
describe("strategy, probability and simulation", () => {
  it("rules-specific H17 soft 18 versus 2 doubles", () => {
    expect(recommend(start(["A", "2", "7", "10"]))).toBe("stand");
    expect(recommend(start(["A", "2", "7", "10"], { hitSoft17: true }))).toBe(
      "double",
    );
  });
  it("DAS changes pair 4 strategy", () => {
    expect(recommend(start(["4", "5", "4", "10"]))).toBe("split");
    expect(recommend(start(["4", "5", "4", "10"], { das: false }))).toBe("hit");
  });
  it("H17 surrender hard 17 against A", () => {
    let g = start(["10", "A", "7", "6"], { hitSoft17: true });
    g = insurance(g, false);
    expect(recommend(g)).toBe("surrender");
  });
  it("unsupported rules do not receive a generic chart", () => {
    expect(strategySupported({ ...defaultRules, hitSplitAces: true })).toBe(
      false,
    );
    expect(
      recommend(start(["10", "6", "6", "10"], { hitSplitAces: true })),
    ).toBe(null);
    expect(deviationsSupported({ ...defaultRules, resplitAces: true })).toBe(
      false,
    );
  });
  it("hard 16 index at zero stands and below hits without surrender", () => {
    const g = start(["10", "10", "6", "7"], { surrender: false });
    expect(adjusted(g, 0)).toBe("stand");
    expect(adjusted(g, -1)).toBe("hit");
  });
  it("indices do not override splitting 8s", () => {
    const g = start(["8", "10", "8", "7"], { surrender: false });
    expect(adjusted(g, 1)).toBe("split");
  });
  it("exact off-the-top natural probability", () => {
    expect(blackjackProbability(createShoe(1, seededRandom(1)))).toBeCloseTo(
      (2 * 4 * 16) / (52 * 51),
    );
  });
  it("observable pool retains hole card and exact exposed-card bust fraction", () => {
    const g = start(["10", "6", "8", "10"]);
    expect(observablePool(g.shoe, g.cursor, g.dealer, g.revealed)).toHaveLength(
      309,
    );
    expect(
      hitBustProbability(cards("10", "8"), cards("2", "3", "4", "K")),
    ).toBe(0.5);
  });
  it("ramp uses ascending upper bounds and caps to limits", () => {
    expect(wager("ramp", 2, 1000, defaultRules, 10, defaultRamp)).toBe(20);
    expect(wager("ramp", 8, 60, defaultRules, 10, defaultRamp)).toBe(60);
  });
  const config: SimulationConfig = {
    rules: defaultRules,
    hands: 1000,
    seed: 42,
    bankroll: 100000,
    mode: "flat",
    unit: 10,
    ramp: defaultRamp,
    kelly: 0.25,
    deviations: false,
    stopLoss: 0,
    stopWin: 0,
  };
  it("shared engine produces deterministic simulations independent of batch size", () => {
    const a = new Simulator(config),
      b = new Simulator(config);
    while (!a.step(100)) {
      /* Advance a deterministic batch. */
    }
    while (!b.step(333)) {
      /* Advance a deterministic batch. */
    }
    expect(a.finish()).toEqual(b.finish());
    expect(a.result.hands).toBe(1000);
    expect(a.g.bankroll / 100).toBe(config.bankroll + a.result.profit);
    expect(a.g.shuffles).toBeGreaterThan(1);
  });
  it("sample count, metrics and conservation remain consistent over 10,000 rounds", () => {
    const sim = new Simulator({ ...config, hands: 10000 });
    while (!sim.step(1000)) {
      /* Advance a deterministic batch. */
    }
    const r = sim.finish();
    expect(r.hands).toBe(10000);
    expect(r.byCount.reduce((n, b) => n + b.hands, 0)).toBe(10000);
    expect(r.histogram.reduce((n, b) => n + b.hands, 0)).toBe(10000);
    expect(Number.isInteger(sim.g.bankroll)).toBe(true);
    expect(sim.g.seen).toBe(sim.g.cursor);
    expect(r.maxDrawdown).toBeGreaterThan(0);
  });
  it("stops at bankroll limit", () => {
    const sim = new Simulator({ ...config, bankroll: 10 });
    while (!sim.step(1000)) {
      /* Advance a deterministic batch. */
    }
    expect(sim.result.hands).toBeLessThan(1000);
    expect(sim.result.reason).toBe("Bankroll below table minimum");
  });
  it("rejects unsupported automated strategies", () =>
    expect(
      () =>
        new Simulator({
          ...config,
          rules: { ...defaultRules, hitSplitAces: true },
        }),
    ).toThrow());
});
