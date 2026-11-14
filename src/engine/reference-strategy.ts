import { Card, value } from "./cards";
import type { Action, Hand } from "./game";
import data from "./reference-values.json";
import type { Rules } from "./rules";
export const referenceValues = data as Record<
  string,
  { source: string; values: Record<string, (number | null)[]> }
>;
export function initialReferenceEV(h: Hand, up: Card, r: Rules) {
  const slug = `${r.holeCard === "peek" ? "" : "euro-"}${r.decks}d${r.hitSoft17 ? "h17" : "s17"}r4`;
  const key = `${value(up)}:${h.cards
    .map(value)
    .sort((a, b) => a - b)
    .join(",")}`;
  return referenceValues[slug]?.values[key];
}
export function referenceInitialAction(
  h: Hand,
  up: Card,
  r: Rules,
  allowed: Action[],
): Action | null {
  const ev = initialReferenceEV(h, up, r);
  if (!ev) return null;
  const candidates: { a: Action; v: number }[] = [];
  for (const [a, i] of [
    ["stand", 0],
    ["hit", 1],
    ["double", 2],
    ["split", r.das ? 4 : 3],
  ] as const) {
    if (allowed.includes(a) && ev[i] !== null && ev[i] !== undefined)
      candidates.push({ a, v: ev[i]! });
  }
  if (allowed.includes("surrender"))
    candidates.push({ a: "surrender", v: -0.5 });
  return candidates.sort((a, b) => b.v - a.v)[0]?.a ?? null;
}
