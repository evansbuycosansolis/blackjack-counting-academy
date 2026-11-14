import { Card, Rank, evaluate } from "@/engine/cards";
import { Action, Hand } from "@/engine/game";
import { referenceValues } from "@/engine/reference-strategy";
import { Rules, defaultRules } from "@/engine/rules";
import { basicAction, strategySupported } from "@/engine/strategy";
import { describe, expect, it } from "vitest";
const h = (a: Rank, b: Rank): Hand => ({
  cards: [
    { id: "a", rank: a, suit: "♠" },
    { id: "b", rank: b, suit: "♥" },
  ],
  bet: 1000,
  original: 1000,
  split: false,
  splitAces: false,
  done: false,
  doubled: false,
  surrendered: false,
});
const up = (rank: Rank): Card => ({ id: "up", rank, suit: "♣" });
const all: Action[] = ["hit", "stand", "double", "split", "surrender"];
const choose = (
  cards: [Rank, Rank],
  dealer: Rank,
  changes: Partial<Rules> = {},
  allowed = all,
) =>
  basicAction(
    h(...cards),
    up(dealer),
    { ...defaultRules, ...changes },
    allowed,
  );
describe("published small-deck and European regressions", () => {
  for (const decks of [1, 2, 4, 6, 8] as const)
    for (const hitSoft17 of [false, true])
      for (const das of [false, true])
        for (const double of ["any", "9-11", "10-11"] as const)
          it(`${decks} decks H17=${hitSoft17} DAS=${das} double=${double}`, () => {
            const r = { ...defaultRules, decks, hitSoft17, das, double };
            expect(strategySupported(r)).toBe(double === "any" || !das);
            if (strategySupported(r)) {
              for (const d of ["2", "6", "10", "A"] as Rank[])
                for (const cards of [
                  ["5", "6"],
                  ["8", "8"],
                  ["A", "7"],
                  ["10", "6"],
                ] as [Rank, Rank][]) {
                  const a = basicAction(h(...cards), up(d), r, [
                    "hit",
                    "stand",
                  ]);
                  expect(["hit", "stand"]).toContain(a);
                }
            }
          });
  it("single-deck doubles hard 8 versus 5", () =>
    expect(choose(["2", "6"], "5", { decks: 1 })).toBe("double"));
  it("double-deck doubles 9 versus 2", () =>
    expect(choose(["4", "5"], "2", { decks: 2 })).toBe("double"));
  it("double-deck soft 18 versus A follows S17/H17 chart distinction", () => {
    expect(choose(["A", "7"], "A", { decks: 2 })).toBe("stand");
    expect(choose(["A", "7"], "A", { decks: 2, hitSoft17: true })).toBe("hit");
  });
  it("single-deck 77 versus ten surrenders or stands", () => {
    expect(choose(["7", "7"], "10", { decks: 1 })).toBe("surrender");
    expect(
      choose(["7", "7"], "10", { decks: 1 }, ["hit", "stand", "split"]),
    ).toBe("stand");
  });
  it("single-deck 44 versus 5 doubles without DAS", () =>
    expect(choose(["4", "4"], "5", { decks: 1, das: false })).toBe("double"));
  it("single-deck H17 99 versus Ace splits with DAS", () =>
    expect(choose(["9", "9"], "A", { decks: 1, hitSoft17: true })).toBe(
      "split",
    ));
  for (const holeCard of ["european", "no-peek"] as const)
    for (const decks of [6, 8] as const)
      it(`${holeCard} ${decks} all-bets delayed blackjack changes exposed actions`, () => {
        const r = { decks, holeCard, dealerBlackjackLoss: "all" as const };
        expect(choose(["5", "6"], "10", r)).toBe("hit");
        expect(choose(["A", "A"], "A", r, ["hit", "stand", "split"])).toBe(
          "hit",
        );
        expect(choose(["8", "8"], "10", r, ["hit", "stand", "split"])).toBe(
          "hit",
        );
      });
  it("reference dataset has complete initial-card composition keys and finite numbers", () => {
    expect(Object.keys(referenceValues)).toHaveLength(14);
    for (const p of Object.values(referenceValues)) {
      expect(Object.keys(p.values)).toHaveLength(550);
      for (const row of Object.values(p.values))
        expect(row.every((x) => x === null || Number.isFinite(x))).toBe(true);
    }
  });
  it("unvalidated split-Ace configurations stay explicit", () => {
    expect(strategySupported({ ...defaultRules, hitSplitAces: true })).toBe(
      false,
    );
    expect(strategySupported({ ...defaultRules, resplitAces: true })).toBe(
      false,
    );
    expect(evaluate(h("A", "A").cards).total).toBe(12);
  });
});
