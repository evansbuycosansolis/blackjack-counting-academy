import { it, expect } from "vitest";
import { exactActionAnalysis } from "@/engine/analysis";
import { newGame, deal, act, Game } from "@/engine/game";
import { Rank, seededRandom, value } from "@/engine/cards";
import { defaultRules } from "@/engine/rules";
const permutations = <T>(xs: T[]): T[][] =>
  xs.length <= 1
    ? [xs]
    : xs.flatMap((x, i) =>
        permutations(xs.filter((_, j) => i !== j)).map((rest) => [x, ...rest]),
      );
for (const holeCard of ["peek", "no-peek", "european"] as const)
  for (const dealerBlackjackLoss of ["all", "original"] as const)
    for (const hitSoft17 of [false, true])
      it(`independent physical-card enumeration agrees with exact action EV: ${holeCard}/${dealerBlackjackLoss}/H17=${hitSoft17}`, () => {
        let g = newGame(
          {
            ...defaultRules,
            holeCard,
            dealerBlackjackLoss,
            hitSoft17,
            insurance: false,
            surrender: false,
          },
          100000,
          seededRandom(3),
        );
        const remaining = [...g.shoe],
          take = (rank: Rank) =>
            remaining.splice(
              remaining.findIndex((c) => c.rank === rank),
              1,
            )[0];
        const visible = ["5", "A", "6"].map((x) => take(x as Rank)),
          unknown = ["2", "10", "A", "6"].map((x) => take(x as Rank));
        g.shoe = [...visible, ...unknown];
        g = deal(g, 10);
        expect(g.phase).toBe("playing");
        const exact = exactActionAnalysis(g, 500000);
        const perms = permutations(unknown).filter(
          (p) => holeCard !== "peek" || value(p[0]) !== 10,
        );
        for (const action of ["stand", "double"] as const) {
          let sum = 0;
          for (const p of perms) {
            const n: Game = {
              ...structuredClone(g),
              shoe: [...visible, ...p],
              dealer:
                holeCard === "european" ? [visible[1]] : [visible[1], p[0]],
            };
            const result = act(n, action);
            sum += (result.bankroll - result.roundStart) / result.initialBet;
          }
          expect(
            exact.actions.find((a) => a.action === action)!.ev,
          ).toBeCloseTo(sum / perms.length, 11);
        }
      });
it("exact split-Ace value matches full no-replacement engine permutations", () => {
  let g = newGame(
    { ...defaultRules, resplitAces: false, insurance: false },
    100000,
    seededRandom(5),
  );
  const rest = [...g.shoe],
    take = (rank: Rank) =>
      rest.splice(
        rest.findIndex((c) => c.rank === rank),
        1,
      )[0],
    visible = ["A", "6", "A"].map((x) => take(x as Rank)),
    unknown = ["2", "10", "9", "5", "10"].map((x) => take(x as Rank));
  g.shoe = [...visible, ...unknown];
  g = deal(g, 10);
  const exact = exactActionAnalysis(g, 500000),
    perms = permutations(unknown);
  let sum = 0;
  for (const p of perms) {
    const n: Game = {
      ...structuredClone(g),
      shoe: [...visible, ...p],
      dealer: [visible[1], p[0]],
    };
    const result = act(n, "split");
    expect(result.phase).toBe("settled");
    sum += (result.bankroll - result.roundStart) / result.initialBet;
  }
  expect(exact.actions.find((x) => x.action === "split")!.ev).toBeCloseTo(
    sum / perms.length,
    10,
  );
});
