import { hilo, seededRandom } from "@/engine/cards";
import { act, deal, insurance, legalActions, newGame } from "@/engine/game";
import { defaultRules } from "@/engine/rules";
import { expect, it } from "vitest";
for (const holeCard of ["peek", "no-peek", "european"] as const)
  it(`random legal play preserves money, composition and observable count: ${holeCard}`, () => {
    const rng = seededRandom(721);
    let g = newGame(
      {
        ...defaultRules,
        holeCard,
        decks: 1,
        resplitAces: true,
        hitSplitAces: true,
      },
      10000000,
      rng,
    );
    for (let i = 0; i < 1500; i++) {
      g = deal(g, 10, rng, true);
      if (g.phase === "insurance") g = insurance(g, rng() > 0.5);
      let steps = 0;
      while (g.phase === "playing") {
        const actions = legalActions(g);
        g = act(g, actions[Math.floor(rng() * actions.length)], true);
        expect(++steps).toBeLessThan(100);
      }
      expect(Number.isInteger(g.bankroll)).toBe(true);
      expect(g.bankroll).toBeGreaterThanOrEqual(0);
      if (!g.hands.some((h) => h.result === "Void")) {
        expect(g.bankroll).toBe(
          g.roundStart -
            g.wagerCount +
            g.hands.reduce((n, h) => n + (h.returned ?? 0), 0) +
            g.insuranceReturned,
        );
        expect(g.running).toBe(
          g.shoe.slice(0, g.cursor).reduce((n, c) => n + hilo(c), 0),
        );
        expect(g.seen).toBe(g.cursor);
      }
      expect(new Set(g.shoe.map((c) => c.id)).size).toBe(52);
    }
  });
