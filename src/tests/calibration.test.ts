import { defaultRamp, wager } from "@/engine/betting";
import {
  EdgeModel,
  empiricalKelly,
  legalMinimum,
  rulesKey,
} from "@/engine/calibration";
import { defaultRules } from "@/engine/rules";
import { Simulator } from "@/engine/simulation";
import { expect, it } from "vitest";
it("empirical Kelly agrees with an independent analytic even-money calculation", () => {
  expect(
    empiricalKelly([
      { value: 1, count: 600 },
      { value: -1, count: 400 },
    ]),
  ).toBeCloseTo(0.2, 10);
  expect(
    empiricalKelly([
      { value: 1.5, count: 500 },
      { value: -1, count: 500 },
    ]),
  ).toBeCloseTo(1 / 6, 10);
  expect(
    empiricalKelly([
      { value: 1, count: 400 },
      { value: -1, count: 600 },
    ]),
  ).toBe(0);
});
it("fractional Kelly and every betting mode honor increments, bankroll and table limits", () => {
  const r = { ...defaultRules, min: 12, max: 503, betIncrement: 5 };
  expect(legalMinimum(r)).toBe(15);
  for (const mode of ["flat", "ramp"] as const)
    for (const bank of [0, 12, 15, 27, 1000]) {
      const b = wager(mode, 3, bank, r, 17, defaultRamp);
      expect(b % 5).toBe(0);
      expect(b).toBeLessThanOrEqual(bank);
      expect(b).toBeLessThanOrEqual(r.max);
      expect(b === 0 || b >= r.min).toBe(true);
    }
  const m: EdgeModel = {
    id: "analytic",
    rulesKey: rulesKey(r),
    policy: "basic",
    seed: 0,
    rounds: 1000,
    bins: [
      {
        tc: 3,
        samples: 1000,
        shoes: 100,
        mean: 0.2,
        ci95: [0.1, 0.3],
        secondMoment: 1,
        kellyFraction: 0.2,
        outcomes: [
          { value: 1, count: 600 },
          { value: -1, count: 400 },
        ],
      },
    ],
    method: "Analytic test distribution",
  };
  expect(wager("kelly", 3, 1000, r, 10, defaultRamp, 0.25, m)).toBe(50);
  expect(() => wager("kelly", 3, 1000, r, 10, defaultRamp, 0.25)).toThrow(
    "calibration",
  );
});
it("calibration counts and return mass agree with the actual simulated rounds", () => {
  const sim = new Simulator({
    rules: defaultRules,
    hands: 10000,
    seed: 42,
    bankroll: 1000000,
    mode: "flat",
    unit: 10,
    ramp: defaultRamp,
    kelly: 0.25,
    deviations: false,
    stopLoss: 0,
    stopWin: 0,
  });
  while (!sim.step(1000)) {
    /* Advance a deterministic batch. */
  }
  const r = sim.finish(),
    m = r.edgeModel!;
  expect(m.bins.reduce((n, b) => n + b.samples, 0)).toBe(10000);
  expect(m.bins.reduce((n, b) => n + b.mean * b.samples * 10, 0)).toBeCloseTo(
    r.profit,
    8,
  );
  for (const b of m.bins)
    expect(b.outcomes.reduce((n, x) => n + x.count, 0)).toBe(b.samples);
  expect(r.shoeClusters).toBeGreaterThan(50);
  expect(r.confidenceMethod).toContain("shoe-cluster");
});
