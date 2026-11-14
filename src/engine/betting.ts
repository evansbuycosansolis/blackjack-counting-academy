import { EdgeModel, legalMinimum, rulesKey } from "./calibration";
import { Rules } from "./rules";
export interface RampRow {
  tc: number;
  bet: number;
}
export const defaultRamp: RampRow[] = [
  { tc: 1, bet: 10 },
  { tc: 2, bet: 20 },
  { tc: 3, bet: 40 },
  { tc: 4, bet: 60 },
  { tc: 5, bet: 80 },
];
export type BettingMode = "flat" | "ramp" | "kelly";
export function wager(
  mode: BettingMode,
  tc: number,
  bankroll: number,
  r: Rules,
  unit: number,
  ramp: RampRow[],
  kelly = 0.25,
  model?: EdgeModel,
) {
  const rows = [...ramp].sort((a, b) => a.tc - b.tc);
  let b = unit;
  if (mode === "ramp")
    b = (rows.find((x) => tc <= x.tc) ?? rows.at(-1))?.bet ?? unit;
  if (mode === "kelly") {
    if (!model || model.rulesKey !== rulesKey(r))
      throw Error("Kelly requires a calibration matching these rules.");
    const bin = model.bins.find(
      (x) => x.tc === Math.max(-10, Math.min(10, tc)),
    );
    b =
      !bin || bin.samples < 100 || bin.shoes < 5
        ? unit
        : Math.max(unit, bankroll * bin.kellyFraction * kelly);
  }
  const increment = r.betIncrement ?? 1,
    cap = Math.floor(Math.min(r.max, bankroll) / increment) * increment;
  if (cap < legalMinimum(r)) return 0;
  return Math.min(
    cap,
    Math.max(legalMinimum(r), Math.floor(b / increment) * increment),
  );
}
export function validateRamp(rows: RampRow[]) {
  return (
    rows.length > 0 &&
    rows.every(
      (r, i) =>
        Number.isFinite(r.tc) &&
        Number.isInteger(r.bet) &&
        r.bet > 0 &&
        (i === 0 || r.tc > rows[i - 1].tc),
    )
  );
}
