import {
  ActionSampler,
  CombinatorialContext,
  exactActionAnalysis,
  rankCounts,
  resampleObservable,
} from "@/engine/analysis";
import { Rank, createShoe, seededRandom, value } from "@/engine/cards";
import { deal, insurance, newGame } from "@/engine/game";
import { referenceValues } from "@/engine/reference-strategy";
import { defaultRules } from "@/engine/rules";
import { describe, expect, it } from "vitest";
function fixture(prefix: Rank[], tail?: Rank[], euro = false) {
  let g = newGame(
    { ...defaultRules, holeCard: euro ? "european" : "peek" },
    100000,
    seededRandom(9),
  );
  const rest = [...g.shoe],
    take = (rank: Rank) =>
      rest.splice(
        rest.findIndex((c) => c.rank === rank),
        1,
      )[0];
  const first = prefix.map(take);
  g.shoe = tail ? [...first, ...tail.map(take)] : [...first, ...rest];
  g = deal(g, 10);
  if (g.phase === "insurance") g = insurance(g, false);
  return g;
}
describe("combinatorial calculations and independent numeric regressions", () => {
  for (const [slug, ref] of Object.entries(referenceValues))
    it(`${slug}: stand EV matches independently published combinatorial values`, () => {
      const decks = Number(slug.match(/(\d)d/)![1]) as 1 | 2 | 4 | 6 | 8,
        hitSoft17 = slug.includes("h17"),
        euro = slug.startsWith("euro");
      for (const key of ["2:8,10", "6:6,10", "10:8,10", "11:9,10"]) {
        const [up, rs] = key.split(":"),
          rv = rs.split(",").map(Number);
        const pool = createShoe(decks, seededRandom(1));
        for (const v of [Number(up), ...rv])
          pool.splice(
            pool.findIndex((c) => value(c) === v),
            1,
          );
        const ctx = new CombinatorialContext(
          {
            ...defaultRules,
            decks,
            hitSoft17,
            holeCard: euro ? "european" : "peek",
          },
          Number(up),
          !euro,
        );
        const d = ctx.dealer(rankCounts(pool)),
          total = rv.reduce((a, b) => a + b, 0);
        let ev = 0;
        for (let j = 0; j < 8; j++) {
          if (j === 7) continue;
          const payoff =
            j === 0
              ? -1
              : j === 1
                ? 1
                : total > j + 15
                  ? 1
                  : total === j + 15
                    ? 0
                    : -1;
          ev += d[j] * payoff;
        }
        expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        expect(ev).toBeCloseTo(ref.values[key][0]!, 5);
      }
    });
  it("exact full-action enumeration respects void/refund, doubles and split correlations", () => {
    const g = fixture(["10", "6", "10", "10"], ["10", "10"]);
    const a = exactActionAnalysis(g);
    expect(a.method).toBe("exact");
    expect(a.actions.find((x) => x.action === "stand")!.ev).toBe(1);
    expect(a.actions.find((x) => x.action === "hit")!.ev).toBe(-1);
    expect(a.actions.find((x) => x.action === "double")!.ev).toBe(-2);
    expect(a.actions.find((x) => x.action === "split")!.ev).toBe(0);
    expect(a.recommended).toBe("stand");
  });
  for (const [slug, ref] of Object.entries(referenceValues))
    it(`${slug}: hit and double EV match independent published initial-composition values`, () => {
      const decks = Number(slug.match(/(\d)d/)![1]) as 1 | 2 | 4 | 6 | 8;
      for (const up of [2, 6, 10, 11])
        for (const [action, column] of [
          ["hit", 1],
          ["double", 2],
        ] as const) {
          const rules = {
            ...defaultRules,
            decks,
            hitSoft17: slug.includes("h17"),
            holeCard: slug.startsWith("euro")
              ? ("european" as const)
              : ("peek" as const),
            insurance: false,
          };
          let g = newGame(rules, 100000, seededRandom(3));
          const rest = [...g.shoe],
            take = (v: number) =>
              rest.splice(
                rest.findIndex((c) => value(c) === v),
                1,
              )[0];
          // European tables suppress dominated hard-total actions with -1/N/V;
          // use their explicitly evaluated hit-16 and soft-19 double cells.
          const player = slug.startsWith("euro")
            ? action === "hit"
              ? [6, 10]
              : [8, 11]
            : [8, 10];
          const prefix = [take(player[0]), take(up), take(player[1])];
          if (rules.holeCard !== "european") prefix.push(take(2));
          g.shoe = [...prefix, ...rest];
          g = deal(g, 10);
          const result = exactActionAnalysis(g, 500000, [action]);
          expect(
            result.actions.find((x) => x.action === action)!.ev,
          ).toBeCloseTo(ref.values[`${up}:${player.join(",")}`][column]!, 5);
        }
    });
  it("Monte Carlo evaluation converges on exact outcomes for a known finite pool", () => {
    const g = fixture(["10", "6", "10", "10"], ["10", "10"]);
    const job = new ActionSampler(g, 2000, 7);
    while (!job.step(100)) {
      /* Advance a deterministic batch. */
    }
    const a = job.finish();
    expect(a.actions.find((x) => x.action === "stand")!.ev).toBe(1);
    expect(a.actions.find((x) => x.action === "double")!.ev).toBe(-2);
  });
  it("resampling depends on the observable multiset rather than actual hidden identity/order", () => {
    const g = fixture(["5", "A", "6", "2"]);
    const original = structuredClone(g),
      n = resampleObservable(g, seededRandom(5));
    expect(g).toEqual(original);
    expect(n.running).toBe(g.running);
    expect(new Set(n.shoe.map((c) => c.id)).size).toBe(n.shoe.length);
    expect(value(n.dealer[1])).not.toBe(10);
    expect(rankCounts([...n.shoe.slice(n.cursor), n.dealer[1]])).toEqual(
      rankCounts([...g.shoe.slice(g.cursor), g.dealer[1]]),
    );
  });
});
