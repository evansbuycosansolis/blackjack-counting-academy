import {
  Card,
  RNG,
  createShoe,
  evaluate,
  hilo,
  secureRandom,
  trueCount,
  value,
} from "./cards";
import { RoundEvent, recordEvent, recordFrame } from "./replay";
import { Rules, defaultRules, validateRules } from "./rules";
// All monetary amounts are integer cents. Initial wagers are whole chips, so
// 3:2, 6:5, half-wager surrender and insurance are represented exactly.
export type Action = "hit" | "stand" | "double" | "split" | "surrender";
export interface Hand {
  cards: Card[];
  bet: number;
  original: number;
  split: boolean;
  splitAces: boolean;
  done: boolean;
  surrendered: boolean;
  doubled: boolean;
  result?: string;
  returned?: number;
}
export interface Decision {
  cards: Card[];
  dealer: Card;
  action: Action;
  recommended: Action | null;
  countRecommended?: Action | null;
  count: number;
}
export interface Game {
  betAssessment?: {
    actual: number;
    recommended: number;
    correct: boolean;
    method: string;
    tc: number;
  };
  recordEvents?: boolean;
  events?: RoundEvent[];
  rules: Rules;
  shoe: Card[];
  cursor: number;
  discards: Card[];
  running: number;
  seen: number;
  shuffles: number;
  dealer: Card[];
  revealed: boolean;
  hands: Hand[];
  active: number;
  phase: "betting" | "insurance" | "playing" | "settled";
  bankroll: number;
  startingBankroll: number;
  roundStart: number;
  initialBet: number;
  insuranceBet: number;
  insuranceReturned: number;
  round: number;
  wagerCount: number;
  message: string;
  decisions: Decision[];
  tcAtBet: number;
}
const hand = (
  cards: Card[],
  bet: number,
  split = false,
  original = bet,
  splitAces = false,
): Hand => ({
  cards,
  bet,
  original,
  split,
  splitAces,
  done: false,
  surrendered: false,
  doubled: false,
});
export function newGame(
  rules: Rules = defaultRules,
  bankroll = 100000,
  rng: RNG = secureRandom,
  recordEvents = false,
): Game {
  validateRules(rules);
  if (!Number.isSafeInteger(bankroll) || bankroll < 0)
    throw Error("Invalid bankroll");
  return {
    recordEvents,
    events: [],
    rules: { ...rules },
    shoe: createShoe(rules.decks, rng),
    cursor: 0,
    discards: [],
    running: 0,
    seen: 0,
    shuffles: 1,
    dealer: [],
    revealed: false,
    hands: [],
    active: 0,
    phase: "betting",
    bankroll,
    startingBankroll: bankroll,
    roundStart: bankroll,
    initialBet: 0,
    insuranceBet: 0,
    insuranceReturned: 0,
    round: 0,
    wagerCount: 0,
    message: "Place your virtual wager to begin.",
    decisions: [],
    tcAtBet: 0,
  };
}
function draw(g: Game, visible = true, owner: number | "dealer" = g.active) {
  const c = g.shoe[g.cursor++];
  if (!c) throw Error("Shoe exhausted. Round must be voided.");
  if (visible) {
    g.running += hilo(c);
    g.seen++;
  }
  recordEvent(g, "draw", { card: c, visible, owner });
  return c;
}
function reveal(g: Game) {
  if (!g.revealed) {
    if (g.dealer.length === 2) {
      g.running += hilo(g.dealer[1]);
      g.seen++;
      recordEvent(g, "reveal", {
        card: g.dealer[1],
        visible: true,
        owner: "dealer",
      });
    }
    g.revealed = true;
    recordFrame(g, "dealer-reveal");
  }
}
export function legalActions(g: Game): Action[] {
  if (g.phase !== "playing") return [];
  const h = g.hands[g.active];
  if (!h || h.done) return [];
  const v = evaluate(h.cards, h.split),
    a: Action[] = ["stand"];
  const pair = h.cards.length === 2 && value(h.cards[0]) === value(h.cards[1]);
  if (
    pair &&
    g.hands.length < g.rules.maxHands &&
    g.bankroll >= h.bet &&
    (!h.splitAces || g.rules.resplitAces)
  )
    a.push("split");
  if (h.splitAces && !g.rules.hitSplitAces) return a;
  a.push("hit");
  if (
    h.cards.length === 2 &&
    g.bankroll >= h.bet &&
    (!h.split || g.rules.das) &&
    (g.rules.double === "any" ||
      (!v.soft &&
        v.total >= (g.rules.double === "9-11" ? 9 : 10) &&
        v.total <= 11))
  )
    a.push("double");
  // Late surrender is supported after a successful peek, or against non-threatening upcards.
  if (
    g.rules.surrender &&
    !h.split &&
    h.cards.length === 2 &&
    (g.rules.holeCard === "peek" || value(g.dealer[0]) < 10)
  )
    a.push("surrender");
  return a;
}
function settle(g: Game) {
  const d = evaluate(g.dealer),
    dealerBJ = d.blackjack;
  g.insuranceReturned = dealerBJ ? g.insuranceBet * 3 : 0;
  g.bankroll += g.insuranceReturned;
  for (const h of g.hands) {
    const p = evaluate(h.cards, h.split);
    let returned = 0,
      result = "Loss";
    if (h.surrendered) {
      returned = h.bet / 2;
      result = "Surrender";
    } else if (p.bust) result = "Bust";
    else if (dealerBJ) {
      if (p.blackjack) {
        returned = h.bet;
        result = "Push";
      } else if (
        g.rules.holeCard !== "peek" &&
        g.rules.dealerBlackjackLoss === "original"
      ) {
        returned = h.bet - h.original;
        result = "Dealer blackjack";
      }
    } else if (p.blackjack) {
      returned =
        h.bet + (g.rules.payout === "3:2" ? (h.bet * 3) / 2 : (h.bet * 6) / 5);
      result = "Blackjack";
    } else if (d.bust || p.total > d.total) {
      returned = h.bet * 2;
      result = "Win";
    } else if (p.total === d.total) {
      returned = h.bet;
      result = "Push";
    }
    h.returned = returned;
    h.result = result;
    g.bankroll += returned;
    h.done = true;
  }
  g.phase = "settled";
  if (!Number.isSafeInteger(g.bankroll))
    throw Error(
      "Virtual balance exceeded the exact-cent integer range. Reduce the configured bankroll or table maximum.",
    );
  const delta = g.bankroll - g.roundStart;
  g.message = `${g.hands.map((h) => h.result).join(" · ")} — ${delta >= 0 ? "+" : ""}${(delta / 100).toFixed(2)} virtual chips`;
  recordFrame(g, "settlement");
}
function finishDealer(g: Game) {
  if (g.rules.holeCard === "european" && g.dealer.length === 1)
    g.dealer.push(draw(g, false, "dealer"));
  reveal(g);
  // Do not draw against busted/surrendered hands or original naturals.
  if (
    g.hands.some(
      (h) =>
        !h.surrendered &&
        !evaluate(h.cards, h.split).bust &&
        !evaluate(h.cards, h.split).blackjack,
    )
  ) {
    let d = evaluate(g.dealer);
    while (
      !d.blackjack &&
      (d.total < 17 || (d.total === 17 && d.soft && g.rules.hitSoft17))
    ) {
      g.dealer.push(draw(g, true, "dealer"));
      d = evaluate(g.dealer);
    }
  }
  settle(g);
}
function advance(g: Game) {
  for (let i = g.active; i < g.hands.length; i++) {
    const h = g.hands[i],
      v = evaluate(h.cards, h.split);
    if (v.total >= 21) h.done = true;
    if (
      h.splitAces &&
      !g.rules.hitSplitAces &&
      !(
        h.cards[1]?.rank === "A" &&
        g.rules.resplitAces &&
        g.hands.length < g.rules.maxHands &&
        g.bankroll >= h.bet
      )
    )
      h.done = true;
    if (!h.done) {
      g.active = i;
      return;
    }
  }
  finishDealer(g);
}
function beginPlay(g: Game) {
  g.phase = "playing";
  if (
    g.rules.holeCard === "peek" &&
    [10, 11].includes(value(g.dealer[0])) &&
    evaluate(g.dealer).blackjack
  ) {
    reveal(g);
    settle(g);
    return;
  }
  if (evaluate(g.hands[0].cards).blackjack) {
    finishDealer(g);
    return;
  }
  advance(g);
}
function guardExhaustion(g: Game, fn: () => void) {
  try {
    fn();
  } catch (e) {
    if (!(e instanceof Error) || !e.message.startsWith("Shoe exhausted"))
      throw e;
    g.bankroll = g.roundStart;
    g.cursor = g.shoe.length;
    g.phase = "settled";
    g.insuranceReturned = 0;
    for (const h of g.hands) {
      h.done = true;
      h.result = "Void";
      h.returned = h.bet;
    }
    g.message =
      "Shoe exhausted: round voided; all wagers refunded. Shuffle next round.";
    recordFrame(g, "void-refund");
  }
}
export function deal(
  input: Game,
  betChips: number,
  rng: RNG = secureRandom,
  inPlace = false,
): Game {
  if (!["betting", "settled"].includes(input.phase))
    throw Error("Complete the current round first.");
  if (
    !Number.isInteger(betChips) ||
    betChips % (input.rules.betIncrement ?? 1) !== 0 ||
    betChips < input.rules.min ||
    betChips > input.rules.max ||
    betChips * 100 > input.bankroll
  )
    throw Error(
      "Wager must be whole chips within table limits and available bankroll.",
    );
  const g = inPlace ? input : structuredClone(input);
  if (g.recordEvents) g.events = [];
  g.discards.push(...g.hands.flatMap((h) => h.cards), ...g.dealer);
  if (
    g.cursor >= Math.floor(g.shoe.length * g.rules.penetration) ||
    g.shoe.length - g.cursor < 4
  ) {
    g.shoe = createShoe(g.rules.decks, rng);
    g.cursor = 0;
    g.discards = [];
    g.running = 0;
    g.seen = 0;
    g.shuffles++;
    recordFrame(g, "shuffle");
  }
  g.tcAtBet = trueCount(
    g.running,
    g.shoe.length - g.cursor,
    g.rules.countPrecision,
    g.rules.countRounding,
  ).index;
  g.roundStart = g.bankroll;
  g.initialBet = betChips * 100;
  g.bankroll -= g.initialBet;
  g.insuranceBet = 0;
  g.insuranceReturned = 0;
  g.round++;
  g.wagerCount = 0;
  g.decisions = [];
  g.hands = [];
  g.dealer = [];
  g.active = 0;
  g.revealed = false;
  g.message = "Your move.";
  guardExhaustion(g, () => {
    const p1 = draw(g),
      d1 = draw(g),
      p2 = draw(g);
    g.dealer = [d1];
    if (g.rules.holeCard !== "european") g.dealer.push(draw(g, false));
    g.hands = [hand([p1, p2], g.initialBet)];
    g.wagerCount = g.initialBet;
    if (d1.rank === "A" && g.rules.insurance) {
      g.phase = "insurance";
      g.message = "Dealer shows an Ace. Insurance or decline?";
    } else beginPlay(g);
  });
  recordFrame(g, "deal-complete");
  return g;
}
export function insurance(input: Game, take: boolean, evenMoney = false): Game {
  if (input.phase !== "insurance") throw Error("Insurance is not available.");
  const g = structuredClone(input);
  recordFrame(
    g,
    evenMoney
      ? "choose-even-money"
      : take
        ? "choose-insurance"
        : "decline-insurance",
  );
  if (evenMoney) {
    if (!evaluate(g.hands[0].cards).blackjack || g.rules.payout !== "3:2")
      throw Error("Even money requires a natural and a 3:2 payout.");
    reveal(g);
    g.hands[0].returned = g.initialBet * 2;
    g.hands[0].result = "Even money";
    g.hands[0].done = true;
    g.bankroll += g.initialBet * 2;
    g.phase = "settled";
    g.message = "Even money: one wager profit.";
    recordFrame(g, "settlement");
    return g;
  }
  if (take) {
    const b = g.initialBet / 2;
    if (g.bankroll < b) throw Error("Insufficient bankroll for insurance.");
    g.insuranceBet = b;
    g.bankroll -= b;
    g.wagerCount += b;
  }
  guardExhaustion(g, () => beginPlay(g));
  recordFrame(g, "insurance-complete");
  return g;
}
export function act(input: Game, action: Action, inPlace = false): Game {
  if (!legalActions(input).includes(action))
    throw Error(`Illegal action: ${action}`);
  const g = inPlace ? input : structuredClone(input),
    h = g.hands[g.active];
  recordFrame(g, `choose-${action}`);
  guardExhaustion(g, () => {
    switch (action) {
      case "hit":
        h.cards.push(draw(g));
        if (evaluate(h.cards).total >= 21) h.done = true;
        break;
      case "stand":
        h.done = true;
        break;
      case "double":
        g.bankroll -= h.bet;
        g.wagerCount += h.bet;
        h.bet *= 2;
        h.doubled = true;
        h.cards.push(draw(g));
        h.done = true;
        break;
      case "surrender":
        h.surrendered = true;
        h.done = true;
        break;
      case "split": {
        g.bankroll -= h.bet;
        g.wagerCount += h.bet;
        const [a, b] = h.cards;
        const aces = a.rank === "A";
        g.hands.splice(
          g.active,
          1,
          hand([a], h.bet, true, h.original, aces),
          hand([b], h.bet, true, 0, aces),
        );
        recordFrame(g, "split-start");
        g.hands[g.active].cards.push(draw(g, true, g.active));
        g.hands[g.active + 1].cards.push(draw(g, true, g.active + 1));
        break;
      }
    }
    advance(g);
  });
  recordFrame(g, `complete-${action}`);
  return g;
}
