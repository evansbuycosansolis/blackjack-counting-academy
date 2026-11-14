import type { Rules } from "./rules";
export interface EdgeBin {
  tc: number;
  samples: number;
  shoes: number;
  mean: number;
  ci95: [number, number];
  secondMoment: number;
  kellyFraction: number;
  outcomes: { value: number; count: number }[];
}
export interface EdgeModel {
  id: string;
  rulesKey: string;
  policy: string;
  seed: number;
  rounds: number;
  bins: EdgeBin[];
  method: string;
}
export function rulesKey(r: Rules) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(r).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
export function empiricalKelly(outcomes: { value: number; count: number }[]) {
  const n = outcomes.reduce((s, x) => s + x.count, 0);
  if (!n) return 0;
  const mean = outcomes.reduce((s, x) => s + x.value * x.count, 0) / n;
  if (mean <= 0) return 0;
  const worst = Math.min(...outcomes.map((x) => x.value));
  const bound = worst < 0 ? Math.min(0.99, 0.999999 / -worst) : 0.99;
  const derivative = (f: number) =>
    outcomes.reduce((s, x) => s + (x.count * x.value) / (1 + f * x.value), 0) /
    n;
  let lo = 0,
    hi = bound;
  if (derivative(hi) >= 0) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (derivative(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
export function legalMinimum(r: Rules) {
  return Math.ceil(r.min / (r.betIncrement ?? 1)) * (r.betIncrement ?? 1);
}
