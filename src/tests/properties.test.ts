import { hilo, seededRandom } from "@/engine/cards";
import { act, deal, insurance, legalActions, newGame } from "@/engine/game";
import { defaultRules } from "@/engine/rules";
import { ActiveTimer } from "@/engine/timer";
import {
  achievements,
  defaultMastery,
  makeTimedDrill,
  mastery,
} from "@/engine/training";
import fc from "fast-check";
import { expect, it } from "vitest";
it("all 34,560 discrete exposed game-rule combinations conserve chips and cards", () => {
  let checked = 0;
  for (const decks of [1, 2, 4, 6, 8] as const)
    for (const hitSoft17 of [false, true])
      for (const payout of ["3:2", "6:5"] as const)
        for (const das of [false, true])
          for (const double of ["any", "9-11", "10-11"] as const)
            for (const maxHands of [2, 3, 4])
              for (const resplitAces of [false, true])
                for (const hitSplitAces of [false, true])
                  for (const surrender of [false, true])
                    for (const offerInsurance of [false, true])
                      for (const holeCard of [
                        "peek",
                        "no-peek",
                        "european",
                      ] as const)
                        for (const dealerBlackjackLoss of [
                          "all",
                          "original",
                        ] as const) {
                          const rng = seededRandom(checked + 93);
                          let g = newGame(
                            {
                              ...defaultRules,
                              decks,
                              hitSoft17,
                              payout,
                              das,
                              double,
                              maxHands,
                              resplitAces,
                              hitSplitAces,
                              surrender,
                              insurance: offerInsurance,
                              holeCard,
                              dealerBlackjackLoss,
                            },
                            100000,
                            rng,
                          );
                          g = deal(g, 10, rng, true);
                          if (g.phase === "insurance")
                            g = insurance(g, checked % 2 === 0);
                          while (g.phase === "playing") {
                            const a = legalActions(g);
                            g = act(g, a[Math.floor(rng() * a.length)], true);
                          }
                          expect(Number.isSafeInteger(g.bankroll)).toBe(true);
                          expect(g.bankroll).toBe(
                            g.roundStart -
                              g.wagerCount +
                              g.hands.reduce(
                                (n, h) => n + (h.returned ?? 0),
                                0,
                              ) +
                              g.insuranceReturned,
                          );
                          expect(g.running).toBe(
                            g.shoe
                              .slice(0, g.cursor)
                              .reduce((n, c) => n + hilo(c), 0),
                          );
                          checked++;
                        }
  expect(checked).toBe(34560);
}, 30000);
it("property-based arbitrary legal action sequences preserve a persistent shoe", () => {
  fc.assert(
    fc.property(
      fc.integer(),
      fc.constantFrom(1, 2, 4, 6, 8),
      fc.array(fc.nat(), { minLength: 1, maxLength: 100 }),
      (seed, decks, choices) => {
        const rng = seededRandom(seed);
        let g = newGame(
          { ...defaultRules, decks: decks as 1 | 2 | 4 | 6 | 8 },
          10000000,
          rng,
        );
        for (const choice of choices) {
          if (g.phase === "betting" || g.phase === "settled")
            g = deal(g, 10, rng, true);
          else if (g.phase === "insurance") g = insurance(g, choice % 2 === 0);
          else {
            const actions = legalActions(g);
            g = act(g, actions[choice % actions.length], true);
          }
          expect(Number.isSafeInteger(g.bankroll)).toBe(true);
          expect(new Set(g.shoe.map((c) => c.id)).size).toBe(52 * decks);
          expect(g.cursor).toBeLessThanOrEqual(g.shoe.length);
        }
      },
    ),
    { numRuns: 75, seed: 481516 },
  );
});
it("timed drills exclude pauses and progression requires measured accuracy plus pace", () => {
  let now = 0;
  const t = new ActiveTimer(() => now);
  t.start();
  now = 1000;
  t.pause();
  now = 9000;
  expect(t.elapsed()).toBe(1000);
  t.start();
  now = 10000;
  t.pause();
  expect(t.elapsed()).toBe(2000);
  const r = makeTimedDrill({
    mode: "Timed sprint",
    cards: 52,
    activeMs: 52000,
    correct: true,
    runningError: 0,
  });
  expect(r.cardsPerMinute).toBe(60);
  const checks = Array.from({ length: 20 }, () => ({
    kind: "counting",
    correct: true,
  }));
  expect(mastery(checks, [r], defaultMastery).mastered).toBe(true);
  expect(
    achievements(checks, [r], 100, [0, 1, 2, 3, 4, 5, 6]).filter(
      (x) => x.earned,
    ).length,
  ).toBeGreaterThanOrEqual(5);
});
