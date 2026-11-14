import { defaultRamp } from "@/engine/betting";
import { seededRandom } from "@/engine/cards";
import { RiskConfig, RiskStudy } from "@/engine/risk";
import { defaultRules } from "@/engine/rules";
import {
  bootstrapMeanCI,
  derivedSeed,
  histogram,
  wilson,
} from "@/engine/statistics";
import { expect, it } from "vitest";
const config: RiskConfig = {
  sessions: 30,
  seed: 42,
  strategies: [
    {
      name: "flat",
      config: {
        rules: defaultRules,
        hands: 100,
        seed: 0,
        bankroll: 100,
        mode: "flat",
        unit: 10,
        ramp: defaultRamp,
        kelly: 0.25,
        deviations: false,
        stopLoss: 0,
        stopWin: 0,
      },
    },
  ],
};
it("Wilson interval retains nonzero upper risk after zero observed ruins", () => {
  expect(wilson(0, 100)[1]).toBeGreaterThan(0.03);
  expect(wilson(100, 100)[0]).toBeLessThan(0.97);
  expect(wilson(50, 100)[0]).toBeCloseTo(0.4038, 3);
});
it("session bootstrap and histograms preserve sample units", () => {
  const ci = bootstrapMeanCI([1, 2, 3, 4, 5], seededRandom(2), 500);
  expect(ci[0]).toBeLessThan(3);
  expect(ci[1]).toBeGreaterThan(3);
  expect(histogram([1, 1, 1]).reduce((s, b) => s + b.count, 0)).toBe(3);
});
it("independent sessions are reproducible and separate from within-shoe dependence", () => {
  const a = new RiskStudy(config),
    b = new RiskStudy(config);
  while (!a.step(30)) {
    /* Advance a deterministic batch. */
  }
  while (!b.step(70)) {
    /* Advance a deterministic batch. */
  }
  expect(a.finish()).toEqual(b.finish());
  const r = a.finish();
  expect(r.outcomes).toHaveLength(30);
  expect(new Set(r.outcomes.map((x) => x.seed)).size).toBe(30);
  expect(r.summaries[0].sessions).toBe(30);
  expect(
    r.summaries[0].survivalProbability + r.summaries[0].ruinProbability,
  ).toBe(1);
  expect(
    r.summaries[0].finalDistribution.reduce((n, b) => n + b.count, 0),
  ).toBe(30);
});
it("paired comparisons of identical strategies have exactly zero differences", () => {
  const s = new RiskStudy({
    ...config,
    sessions: 10,
    strategies: [
      config.strategies[0],
      { ...config.strategies[0], name: "same" },
    ],
  });
  while (!s.step(100)) {
    /* Advance a deterministic batch. */
  }
  expect(s.finish().comparisons[0]).toMatchObject({
    meanDifference: 0,
    ci: [0, 0],
    pairs: 10,
  });
});
it("derived seeds are deterministic across requested horizons", () => {
  expect(derivedSeed(7, 1)).toBe(derivedSeed(7, 1));
  expect(derivedSeed(7, 1)).not.toBe(derivedSeed(7, 2));
});
