import { Card, evaluate, trueCount, value } from "./cards";
import { Action, Game, Hand, legalActions } from "./game";
import {
  applicableIndex,
  indexDecision,
  IndexProfile,
  indexProfileMatches,
  selectProfile,
} from "./index-profiles";
import { deviations, type Deviation } from "./indices-data";
import { referenceInitialAction } from "./reference-strategy";
import { Rules } from "./rules";
import { smallDeckChart } from "./small-deck-strategy";
export const strategySupported = (r: Rules) =>
  (r.holeCard === "peek" ||
    ([6, 8].includes(r.decks) && r.dealerBlackjackLoss === "all")) &&
  (r.double === "any" || !r.das) &&
  r.maxHands === 4 &&
  !r.hitSplitAces &&
  !r.resplitAces;
export const strategyScope =
  "Validated chart profiles: 1/2/4/6/8-deck US peek and 6/8-deck all-bets delayed-blackjack games, S17/H17, four split hands, no resplitting/hitting split Aces. Restricted doubling is supported with no DAS; unrestricted doubling supports DAS or no DAS. Other combinations use composition analysis; automatic chart coaching stays disabled.";
export function basicAction(
  h: Hand,
  up: Card,
  r: Rules,
  allowed: Action[],
): Action | null {
  if (!strategySupported(r)) return null;
  if (r.holeCard !== "peek" && !h.split && h.cards.length === 2)
    return referenceInitialAction(h, up, r, allowed);
  if (r.decks <= 2) return smallDeckChart(h, up, r, allowed);
  const { total: t, soft } = evaluate(h.cards, h.split),
    d = value(up),
    pair =
      h.cards.length === 2 && value(h.cards[0]) === value(h.cards[1])
        ? value(h.cards[0])
        : 0;
  if (r.holeCard !== "peek") {
    if (pair === 8 && d >= 10) return "hit";
    if (pair === 11 && d === 11)
      return h.splitAces && !r.hitSplitAces ? "stand" : "hit";
    if (!soft && t === 11 && d >= 10) return "hit";
  }
  const can = (a: Action) => allowed.includes(a),
    dbl = (fallback: Action = "hit"): Action =>
      can("double") ? "double" : fallback;
  if (
    can("surrender") &&
    !soft &&
    ((t === 16 && pair !== 8 && d >= 9) ||
      (t === 15 && (d === 10 || (r.hitSoft17 && d === 11))) ||
      (r.hitSoft17 && d === 11 && (t === 17 || pair === 8)))
  )
    return "surrender";
  if (
    can("split") &&
    (pair === 11 ||
      pair === 8 ||
      ([2, 3].includes(pair) && d <= 7 && (d >= 4 || r.das)) ||
      (pair === 4 && r.das && [5, 6].includes(d)) ||
      (pair === 6 && d <= 6 && (d >= 3 || r.das)) ||
      (pair === 7 && d <= 7) ||
      (pair === 9 && (d <= 6 || d === 8 || d === 9)))
  )
    return "split";
  if (h.splitAces && !r.hitSplitAces) return "stand";
  if (soft) {
    if (t >= 20) return "stand";
    if (t === 19) return r.hitSoft17 && d === 6 ? dbl("stand") : "stand";
    if (t === 18) {
      if ((d >= 3 && d <= 6) || (r.hitSoft17 && d === 2)) return dbl("stand");
      return d <= 8 ? "stand" : "hit";
    }
    if (t === 17 && d >= 3 && d <= 6) return dbl();
    if ((t === 15 || t === 16) && d >= 4 && d <= 6) return dbl();
    if ((t === 13 || t === 14) && d >= 5 && d <= 6) return dbl();
    return "hit";
  }
  if (t >= 17) return "stand";
  if (t >= 13) return d <= 6 ? "stand" : "hit";
  if (t === 12) return d >= 4 && d <= 6 ? "stand" : "hit";
  if (t === 11) return d !== 11 || r.hitSoft17 ? dbl() : "hit";
  if (t === 10) return d <= 9 ? dbl() : "hit";
  if (t === 9) return d >= 3 && d <= 6 ? dbl() : "hit";
  return "hit";
}
export function recommend(g: Game): Action | null {
  const h = g.hands[g.active];
  return h && g.phase === "playing"
    ? basicAction(h, g.dealer[0], g.rules, legalActions(g))
    : null;
}
export { deviations } from "./indices-data";
export const deviationsSupported = (r: Rules, p = selectProfile(r)) =>
  strategySupported(r) && !!p && indexProfileMatches(p, r);
export function adjusted(
  g: Game,
  tc = trueCount(
    g.running,
    g.shoe.length - g.cursor,
    g.rules.countPrecision,
    g.rules.countRounding,
  ).index,
  profile?: IndexProfile,
): Action | null {
  const base = recommend(g);
  const p = profile ?? selectProfile(g.rules);
  if (!deviationsSupported(g.rules, p) || !p || !base) return base;
  if (p.id !== "i18-s17") {
    const x = applicableIndex(g, p, tc);
    if (!x) return base;
    const pair8 =
      g.hands[g.active].cards.length === 2 &&
      g.hands[g.active].cards.every((c) => c.rank === "8");
    if (pair8 && !x.pair) return base;
    const a = indexDecision(x, tc, g.running);
    return a !== "insurance" && a !== "decline" && legalActions(g).includes(a)
      ? a
      : base;
  }
  const h = g.hands[g.active],
    v = evaluate(h.cards, h.split),
    allowed = legalActions(g);
  if (v.soft || (h.cards.length === 2 && h.cards.every((c) => c.rank === "8")))
    return base;
  const match = (x: Deviation) =>
    x.hand === v.total &&
    x.dealer === value(g.dealer[0]) &&
    (!x.pair ||
      (h.cards.length === 2 &&
        value(h.cards[0]) === 10 &&
        value(h.cards[1]) === 10));
  const surrender = deviations.find((x) => x.set === "F4" && match(x));
  if (surrender && tc >= surrender.index && allowed.includes("surrender"))
    return "surrender";
  const x = deviations.find((x) => x.set === "I18" && match(x));
  if (x) {
    const a = tc >= x.index ? x.above : x.below;
    if (a !== "insurance" && allowed.includes(a)) return a;
  }
  // Below a surrender index use the applicable I18 or a no-surrender base chart.
  if (surrender && tc < surrender.index)
    return basicAction(
      h,
      g.dealer[0],
      g.rules,
      allowed.filter((a) => a !== "surrender"),
    );
  return base;
}
export function explain(h: Hand, up: Card, a: Action | null, r: Rules) {
  if (!a) return strategyScope;
  const v = evaluate(h.cards, h.split);
  return `${v.soft ? "Soft" : "Hard"} ${v.total} versus ${up.rank}: ${a}. ${a === "double" ? "Commit one additional wager, take exactly one card." : a === "split" ? "Play the pair as separate hands with equal wagers." : a === "surrender" ? "Late surrender returns half your original wager." : a === "stand" ? "Keep this total and let the dealer finish." : "Improve this hand by drawing another card."} ${r.hitSoft17 ? "H17" : "S17"} · ${r.das ? "DAS" : "No DAS"}.`;
}
