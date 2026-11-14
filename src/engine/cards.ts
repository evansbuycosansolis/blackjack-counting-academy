export type Rank =
  "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Suit = "♠" | "♥" | "♦" | "♣";
export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}
export const ranks: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
export const suits: Suit[] = ["♠", "♥", "♦", "♣"];
export const value = (c: Card) =>
  c.rank === "A" ? 11 : ["J", "Q", "K"].includes(c.rank) ? 10 : Number(c.rank);
export const hilo = (c: Card) => (value(c) <= 6 ? 1 : value(c) >= 10 ? -1 : 0);
export function evaluate(cards: Card[], split = false) {
  let total = cards.reduce((s, c) => s + value(c), 0),
    aces = cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return {
    total,
    soft: aces > 0,
    bust: total > 21,
    blackjack: !split && cards.length === 2 && total === 21,
  };
}
export type RNG = () => number;
export const secureRandom: RNG = () => {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 4294967296;
};
export function seededRandom(seed: number): RNG {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createShoe(decks: number, rng: RNG = secureRandom): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++)
    for (const suit of suits)
      for (const rank of ranks)
        cards.push({ id: `${d}-${suit}-${rank}`, rank, suit });
  for (let i = cards.length - 1; i > 0; i--) {
    // Rejection sampling avoids finite-32-bit range bias in production shuffles.
    const n = i + 1,
      limit = Math.floor(4294967296 / n) * n;
    let sample: number;
    do {
      sample = Math.floor(rng() * 4294967296);
    } while (sample >= limit);
    const j = sample % n;
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export type Rounding = "floor" | "truncate" | "round";
export function trueCount(
  rc: number,
  remaining: number,
  precision = 0.5,
  rounding: Rounding = "floor",
) {
  const decks = Math.max(
    precision,
    Math.round(remaining / 52 / precision) * precision,
  );
  const raw = rc / decks;
  return {
    decks,
    raw,
    index:
      rounding === "floor"
        ? Math.floor(raw)
        : rounding === "truncate"
          ? Math.trunc(raw)
          : Math.round(raw),
  };
}
