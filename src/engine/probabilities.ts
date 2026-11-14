import { Card, evaluate, value } from "./cards";
// Observable pool removes only exposed cards, retaining an unknown hole card.
export function observablePool(
  shoe: Card[],
  cursor: number,
  dealer: Card[],
  revealed: boolean,
) {
  return [
    ...shoe.slice(cursor),
    ...(!revealed && dealer.length === 2 ? [dealer[1]] : []),
  ];
}
export function hitBustProbability(cards: Card[], unknown: Card[]) {
  return unknown.length
    ? unknown.filter((c) => evaluate([...cards, c]).bust).length /
        unknown.length
    : 0;
}
export function blackjackProbability(pool: Card[]) {
  const a = pool.filter((c) => c.rank === "A").length,
    t = pool.filter((c) => value(c) === 10).length,
    n = pool.length;
  return n > 1 ? (2 * a * t) / (n * (n - 1)) : 0;
}
/** Exact observable next-card fraction conditioned on a successful US peek.
 * The unknown hole card is uniformly distributed over eligible physical cards.
 * Integrate it out; do not look at the engine's actual hidden rank.
 */
export function conditionedHitBust(
  cards: Card[],
  unknown: Card[],
  up: Card,
  peekExcludedBlackjack: boolean,
) {
  const forbidden = peekExcludedBlackjack
    ? up.rank === "A"
      ? 10
      : value(up) === 10
        ? 11
        : 0
    : 0;
  if (!forbidden || unknown.length < 2)
    return hitBustProbability(cards, unknown);
  const eligible = unknown.filter((c) => value(c) !== forbidden),
    busts = unknown.filter((c) => evaluate([...cards, c]).bust).length;
  if (!eligible.length) return hitBustProbability(cards, unknown);
  const holeBust =
    eligible.filter((c) => evaluate([...cards, c]).bust).length /
    eligible.length;
  return (busts - holeBust) / (unknown.length - 1);
}
// Deterministic Monte Carlo from the observable pool, conditional on no dealer
// natural when a US peek has occurred. This never inspects the real hole rank.
export function dealerBustEstimate(
  up: Card,
  pool: Card[],
  hitSoft17: boolean,
  peekExcludedBlackjack: boolean,
  samples = 4000,
) {
  let seed = 907;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const counts = Array(12).fill(0) as number[];
  for (const c of pool) counts[value(c)]++;
  const forbidden = peekExcludedBlackjack
    ? up.rank === "A"
      ? 10
      : value(up) === 10
        ? 11
        : 0
    : 0;
  let busts = 0,
    completed = 0;
  for (let i = 0; i < samples; i++) {
    const left = counts.slice();
    let total = value(up),
      soft = Number(total === 11),
      n = pool.length;
    const take = (excluded = 0) => {
      const eligible = n - (excluded ? left[excluded] : 0);
      if (eligible <= 0) return 0;
      let pick = Math.floor(rng() * eligible);
      for (let v = 2; v <= 11; v++) {
        if (v === excluded) continue;
        pick -= left[v];
        if (pick < 0) {
          left[v]--;
          n--;
          return v;
        }
      }
      return 0;
    };
    const add = (v: number) => {
      total += v;
      if (v === 11) soft++;
      while (total > 21 && soft) {
        total -= 10;
        soft--;
      }
    };
    const hole = take(forbidden);
    if (!hole) continue;
    add(hole);
    while (total < 17 || (total === 17 && soft > 0 && hitSoft17)) {
      const v = take();
      if (!v) break;
      add(v);
    }
    completed++;
    if (total > 21) busts++;
  }
  const probability = completed ? busts / completed : 0;
  return {
    probability,
    samples: completed,
    margin: completed
      ? 1.96 * Math.sqrt((probability * (1 - probability)) / completed)
      : 0,
  };
}
