import { Card, Rank } from "@/engine/cards";
import { conditionedHitBust, dealerBustEstimate } from "@/engine/probabilities";
import { describe, expect, it } from "vitest";
const cs = (...r: Rank[]): Card[] =>
  r.map((rank, i) => ({ rank, suit: "♠", id: String(i) }));
describe("observable probability calculations", () => {
  it("integrates out a hidden hole card after Ace peek", () => {
    expect(
      conditionedHitBust(cs("10", "6"), cs("10", "2", "3"), cs("A")[0], true),
    ).toBe(0.5);
  });
  it("integrates out a hidden Ace exclusion after ten peek", () => {
    expect(
      conditionedHitBust(cs("10", "2"), cs("A", "10", "2"), cs("K")[0], true),
    ).toBe(0.25);
  });
  it("dealer Monte Carlo draws without replacement and detects forced bust", () => {
    const r = dealerBustEstimate(
      cs("6")[0],
      cs("10", "10"),
      false,
      false,
      1000,
    );
    expect(r.probability).toBe(1);
    expect(r.margin).toBe(0);
    expect(r.samples).toBe(1000);
  });
  it("dealer Monte Carlo is deterministic and matches a two-card observable pool", () => {
    const a = dealerBustEstimate(
      cs("10")[0],
      cs("6", "10"),
      false,
      false,
      10000,
    );
    expect(a.probability).toBeCloseTo(0.5, 1);
    expect(a).toEqual(
      dealerBustEstimate(cs("10")[0], cs("6", "10"), false, false, 10000),
    );
  });
});
