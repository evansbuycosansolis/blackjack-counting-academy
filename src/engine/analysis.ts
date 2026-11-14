import { Card, RNG, evaluate, seededRandom, value } from "./cards";
import { Action, Game, Hand, act, legalActions } from "./game";
import { observablePool } from "./probabilities";
import { Rules } from "./rules";
import { recommend } from "./strategy";
export const outcomeNames = [
  "blackjack",
  "bust",
  "17",
  "18",
  "19",
  "20",
  "21",
  "exhausted",
] as const;
export type Distribution = number[];
export interface ActionEV {
  action: Action;
  ev: number;
  ci95: [number, number];
  samples: number;
}
export interface AnalysisResult {
  method: "exact" | "monte-carlo";
  actions: ActionEV[];
  dealer: Distribution;
  dealerMethod: "exact" | "monte-carlo";
  dealerSamples: number;
  dealerCI: [number, number][];
  insurance: { available: boolean; probability: number; ev: number };
  composition: { value: number; cards: number; probability: number }[];
  states: number;
  recommended: Action | null;
  samples: number;
  seed: number;
  assumptions: string;
  reference: string;
}
export class AnalysisLimit extends Error {
  constructor() {
    super("Exact-state budget exceeded");
  }
}
export const rankCounts = (pool: Card[]) => {
  const c = Array(12).fill(0) as number[];
  for (const x of pool) c[value(x)]++;
  return c;
};
const count = (c: number[]) => c.reduce((a, b) => a + b, 0);
const evalValues = (v: number[]) => {
  let total = v.reduce((a, b) => a + b, 0),
    soft = v.filter((x) => x === 11).length;
  while (total > 21 && soft) {
    total -= 10;
    soft--;
  }
  return { total, soft: soft > 0, bust: total > 21 };
};
function unit(i: number): Distribution {
  const a = Array(8).fill(0) as number[];
  a[i] = 1;
  return a;
}
export class CombinatorialContext {
  states = 0;
  memo = new Map<string, Distribution>();
  constructor(
    public rules: Rules,
    public up: number,
    public peek: boolean,
    public limit = 250000,
  ) {}
  visit() {
    if (++this.states > this.limit) throw new AnalysisLimit();
  }
  holeForbidden() {
    return this.peek ? (this.up === 11 ? 10 : this.up === 10 ? 11 : 0) : 0;
  }
  playerProbabilities(c: number[]) {
    const n = count(c),
      reserved = this.rules.holeCard !== "european",
      forbidden = this.holeForbidden(),
      eligible = n - (forbidden ? c[forbidden] : 0);
    if (n <= Number(reserved)) return [];
    return c.map((amount, v) => {
      if (!amount) return 0;
      const pHole = reserved ? (v !== forbidden ? amount / eligible : 0) : 0;
      return reserved ? (amount - pHole) / (n - 1) : amount / n;
    });
  }
  dealer(c: number[], draw = true): Distribution {
    const n = count(c),
      forbidden = this.holeForbidden(),
      eligible = n - (forbidden ? c[forbidden] : 0);
    if (eligible <= 0) return unit(7);
    const out = Array(8).fill(0) as number[];
    for (let v = 2; v <= 11; v++) {
      if (!c[v] || v === forbidden) continue;
      const p = c[v] / eligible;
      c[v]--;
      let d: Distribution;
      const x = evalValues([this.up, v]);
      if (x.total === 21) d = unit(0);
      else if (!draw) d = unit(2);
      else d = this.dealerContinue(c, x.total, x.soft);
      c[v]++;
      for (let j = 0; j < 8; j++) out[j] += p * d[j];
    }
    return out;
  }
  private dealerContinue(
    c: number[],
    total: number,
    soft: boolean,
  ): Distribution {
    if (total > 21) return unit(1);
    if (total > 17 || (total === 17 && (!soft || !this.rules.hitSoft17)))
      return unit(total - 15);
    const n = count(c);
    if (!n) return unit(7);
    const key = c.join(",") + "|" + total + "|" + Number(soft),
      cached = this.memo.get(key);
    if (cached) return cached;
    this.visit();
    const out = Array(8).fill(0) as number[];
    for (let v = 2; v <= 11; v++) {
      if (!c[v]) continue;
      const p = c[v] / n;
      c[v]--;
      let t = total + v,
        s = Number(soft) + Number(v === 11);
      while (t > 21 && s) {
        t -= 10;
        s--;
      }
      const d = this.dealerContinue(c, t, s > 0);
      c[v]++;
      for (let j = 0; j < 8; j++) out[j] += p * d[j];
    }
    this.memo.set(key, out);
    return out;
  }
}
interface SolverHand {
  v: number[];
  bet: number;
  original: number;
  split: boolean;
  aces: boolean;
  done: boolean;
  surrender: boolean;
}
const solverHand = (h: Hand): SolverHand => ({
  v: h.cards.map(value),
  bet: h.bet,
  original: h.original,
  split: h.split,
  aces: h.splitAces,
  done: h.done,
  surrender: h.surrendered,
});
export function insuranceEV(g: Game) {
  if (!g.dealer[0] || value(g.dealer[0]) !== 11)
    return { available: false, probability: 0, ev: 0 };
  const pool = observablePool(g.shoe, g.cursor, g.dealer, g.revealed),
    p = pool.length
      ? pool.filter((c) => value(c) === 10).length / pool.length
      : 0;
  const probability =
    g.rules.holeCard === "peek" && g.phase === "playing" ? 0 : p;
  return {
    available: g.phase === "insurance",
    probability,
    ev: 3 * probability - 1,
  };
}
export function exactActionStudy(
  g: Game,
  limit = 150000,
  firstActions = legalActions(g),
) {
  if (g.phase !== "playing")
    throw Error("Action analysis requires a live player decision.");
  const pool = observablePool(g.shoe, g.cursor, g.dealer, g.revealed),
    counts = rankCounts(pool),
    up = value(g.dealer[0]),
    ctx = new CombinatorialContext(
      g.rules,
      up,
      g.rules.holeCard === "peek",
      limit,
    ),
    memo = new Map<string, number>(),
    policy = new Map<string, Action>();
  const root = g.hands.map(solverHand),
    scale = g.initialBet,
    r = g.rules;
  const normalize = (hs: SolverHand[], bank: number) => {
    for (const h of hs) {
      if (h.done) continue;
      const x = evalValues(h.v);
      if (x.total >= 21) h.done = true;
      if (
        h.aces &&
        !r.hitSplitAces &&
        !(
          h.v.length === 2 &&
          h.v[1] === 11 &&
          r.resplitAces &&
          hs.length < r.maxHands &&
          bank >= h.bet
        )
      )
        h.done = true;
    }
  };
  function terminal(c: number[], hs: SolverHand[], bank: number) {
    const draw = hs.some(
      (h) =>
        !h.surrender &&
        !evalValues(h.v).bust &&
        !(h.v.length === 2 && !h.split && evalValues(h.v).total === 21),
    );
    const d = ctx.dealer(c, draw);
    let result = 0;
    for (let j = 0; j < 8; j++) {
      if (!d[j]) continue;
      if (j === 7) continue;
      let returns = j === 0 ? g.insuranceBet * 3 : 0;
      for (const h of hs) {
        const p = evalValues(h.v),
          natural = h.v.length === 2 && !h.split && p.total === 21;
        let ret = 0;
        if (h.surrender) ret = h.bet / 2;
        else if (p.bust) ret = 0;
        else if (j === 0)
          ret = natural
            ? h.bet
            : r.holeCard !== "peek" && r.dealerBlackjackLoss === "original"
              ? h.bet - h.original
              : 0;
        else if (natural) ret = h.bet * (r.payout === "3:2" ? 2.5 : 2.2);
        else if (j === 1 || p.total > j + 15) ret = h.bet * 2;
        else if (p.total === j + 15) ret = h.bet;
        returns += ret;
      }
      result += (d[j] * (bank + returns - g.roundStart)) / scale;
    }
    return result;
  }
  function allowed(hs: SolverHand[], i: number, bank: number): Action[] {
    const h = hs[i],
      v = evalValues(h.v),
      a: Action[] = ["stand"];
    if (
      h.v.length === 2 &&
      h.v[0] === h.v[1] &&
      hs.length < r.maxHands &&
      bank >= h.bet &&
      (!h.aces || r.resplitAces)
    )
      a.push("split");
    if (h.aces && !r.hitSplitAces) return a;
    a.push("hit");
    if (
      h.v.length === 2 &&
      bank >= h.bet &&
      (!h.split || r.das) &&
      (r.double === "any" ||
        (!v.soft && v.total >= (r.double === "9-11" ? 9 : 10) && v.total <= 11))
    )
      a.push("double");
    if (
      r.surrender &&
      !h.split &&
      h.v.length === 2 &&
      (r.holeCard === "peek" || up < 10)
    )
      a.push("surrender");
    return a;
  }
  function visit(c: number[], hs: SolverHand[], bank: number): number {
    normalize(hs, bank);
    const i = hs.findIndex((h) => !h.done);
    if (i < 0) return terminal(c, hs, bank);
    const key = c.join(",") + "|" + bank + "|" + JSON.stringify(hs),
      cached = memo.get(key);
    if (cached !== undefined) return cached;
    ctx.visit();
    let best = -Infinity;
    for (const action of allowed(hs, i, bank)) {
      const ev = branch(c, hs, i, bank, action);
      if (ev > best) {
        best = ev;
        policy.set(key, action);
      }
    }
    memo.set(key, best);
    return best;
  }
  function branch(
    c: number[],
    hs: SolverHand[],
    i: number,
    bank: number,
    action: Action,
  ): number {
    const next = hs.map((h) => ({ ...h, v: [...h.v] })),
      h = next[i];
    if (action === "stand" || action === "surrender") {
      h.done = true;
      h.surrender = action === "surrender";
      return visit(c, next, bank);
    }
    const probs = ctx.playerProbabilities(c);
    if (!probs.length) return 0;
    let result = 0;
    for (let v = 2; v <= 11; v++) {
      const p = probs[v];
      if (!p) continue;
      c[v]--;
      if (action === "split") {
        const second = ctx.playerProbabilities(c);
        if (second.length)
          for (let w = 2; w <= 11; w++) {
            const q = second[w];
            if (!q) continue;
            c[w]--;
            const splitHand = (n: number, original: number): SolverHand => ({
              v: [h.v[0], n],
              bet: h.bet,
              original,
              split: true,
              aces: h.v[0] === 11,
              done: false,
              surrender: false,
            });
            const child = hs.map((x) => ({ ...x, v: [...x.v] }));
            child.splice(i, 1, splitHand(v, h.original), splitHand(w, 0));
            result += p * q * visit(c, child, bank - h.bet);
            c[w]++;
          }
      } else {
        const child = hs.map((x) => ({ ...x, v: [...x.v] }));
        child[i].v.push(v);
        if (action === "double") {
          child[i].bet *= 2;
          child[i].done = true;
        }
        result += p * visit(c, child, bank - (action === "double" ? h.bet : 0));
      }
      c[v]++;
    }
    return result;
  }
  if (
    !firstActions.length ||
    firstActions.some((action) => !legalActions(g).includes(action))
  )
    throw Error("Exact analysis requested an illegal initial action.");
  const actions = firstActions.map((action) => {
    const ev = branch(counts, root, g.active, g.bankroll, action);
    return { action, ev, ci95: [ev, ev] as [number, number], samples: 0 };
  });
  const dealer = ctx.dealer(counts);
  const total = pool.length;
  const result: AnalysisResult = {
    method: "exact",
    actions,
    dealer,
    dealerMethod: "exact",
    dealerSamples: 0,
    dealerCI: dealer.map((p) => [p, p]),
    insurance: insuranceEV(g),
    composition: counts
      .map((cards, v) => ({
        value: v,
        cards,
        probability: total ? cards / total : 0,
      }))
      .filter((x) => x.cards),
    states: ctx.states,
    recommended: [...actions].sort((a, b) => b.ev - a.ev)[0]?.action ?? null,
    samples: 0,
    seed: 0,
    assumptions:
      "Exact finite multiset enumeration with optimal future legal actions, shared split-hand composition, observed cards only, peek-conditioned hidden-card posterior, actual bankroll/split/double limits. EV is net round profit per initial round wager. Exhausted branches void/refund the round. Floating-point arithmetic evaluates combinatorial probabilities.",
    reference: "docs/MATHEMATICS.md",
  };
  return {
    result,
    continuation: (state: Game): Action => {
      const hs = state.hands.map(solverHand);
      normalize(hs, state.bankroll);
      const c = rankCounts(
        observablePool(state.shoe, state.cursor, state.dealer, state.revealed),
      );
      const key = c.join(",") + "|" + state.bankroll + "|" + JSON.stringify(hs);
      const action = policy.get(key);
      if (!action || !legalActions(state).includes(action))
        throw Error(
          "Continuation state is outside the enumerated exact policy.",
        );
      return action;
    },
  };
}
export function exactActionAnalysis(
  g: Game,
  limit = 150000,
  firstActions?: Action[],
): AnalysisResult {
  return exactActionStudy(g, limit, firstActions).result;
}
export function resampleObservable(g: Game, rng: RNG): Game {
  const pool = observablePool(g.shoe, g.cursor, g.dealer, g.revealed),
    hidden = !g.revealed && g.dealer.length === 2;
  let hole: Card | undefined;
  if (hidden) {
    const up = value(g.dealer[0]),
      forbidden =
        g.rules.holeCard === "peek" ? (up === 11 ? 10 : up === 10 ? 11 : 0) : 0;
    const eligible = pool
      .map((c, i) => ({ c, i }))
      .filter((x) => value(x.c) !== forbidden);
    if (!eligible.length)
      throw Error("Impossible observable hole-card posterior");
    const pick = eligible[Math.floor(rng() * eligible.length)];
    hole = pool.splice(pick.i, 1)[0];
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const prefix = g.shoe.slice(0, g.cursor);
  if (hole) {
    const old = prefix.findIndex((c) => c.id === g.dealer[1].id);
    if (old < 0) throw Error("Hidden card missing from shoe");
    prefix[old] = hole;
  }
  return {
    ...g,
    recordEvents: false,
    events: [],
    rules: { ...g.rules },
    shoe: [...prefix, ...pool],
    hands: g.hands.map((h) => ({ ...h, cards: [...h.cards] })),
    dealer: hole ? [g.dealer[0], hole] : [...g.dealer],
    discards: [],
    decisions: [],
  };
}
export function rolloutAction(g: Game): Action {
  const a = recommend(g);
  if (a) return a;
  const h = g.hands[g.active],
    v = evaluate(h.cards, h.split),
    allowed = legalActions(g);
  return v.total < (v.soft ? 19 : 17) && allowed.includes("hit")
    ? "hit"
    : "stand";
}
export class ActionSampler {
  curve: {
    samples: number;
    action: Action;
    mean: number;
    low: number;
    high: number;
  }[] = [];
  legal: Action[];
  sums: number[];
  squares: number[];
  samples = 0;
  rng: RNG;
  dealerCounts = Array(8).fill(0) as number[];
  constructor(
    public game: Game,
    public target = 10000,
    public seed = 42,
    public continuation: (state: Game) => Action = rolloutAction,
    public exactPolicy = false,
  ) {
    this.legal = legalActions(game);
    if (!this.legal.length) throw Error("No legal player actions to analyze");
    this.sums = this.legal.map(() => 0);
    this.squares = this.legal.map(() => 0);
    this.rng = seededRandom(seed);
  }
  step(batch = 100) {
    for (let i = 0; i < batch && this.samples < this.target; i++) {
      const base = resampleObservable(this.game, this.rng);
      for (let j = 0; j < this.legal.length; j++) {
        let n: Game = {
          ...base,
          hands: base.hands.map((h) => ({ ...h, cards: [...h.cards] })),
          dealer: [...base.dealer],
          decisions: [],
        };
        n = act(n, this.legal[j], true);
        let guard = 0;
        while (n.phase === "playing") {
          if (++guard > 200) throw Error("Analysis rollout did not terminate");
          n = act(n, this.continuation(n), true);
        }
        const x = (n.bankroll - n.roundStart) / n.initialBet;
        this.sums[j] += x;
        this.squares[j] += x * x;
      }
      let stood: Game = {
        ...base,
        hands: base.hands.map((h) => ({ ...h, cards: [...h.cards] })),
        dealer: [...base.dealer],
      };
      while (stood.phase === "playing") stood = act(stood, "stand", true);
      const dealer = evaluate(stood.dealer),
        outcome = stood.hands.some((h) => h.result === "Void")
          ? 7
          : dealer.blackjack
            ? 0
            : dealer.bust
              ? 1
              : Math.max(2, Math.min(6, dealer.total - 15));
      this.dealerCounts[outcome]++;
      this.samples++;
    }
    if (this.samples > 1) {
      for (let j = 0; j < this.legal.length; j++) {
        const n = this.samples,
          mean = this.sums[j] / n;
        const margin =
          1.96 *
          Math.sqrt(
            Math.max(0, (this.squares[j] - this.sums[j] ** 2 / n) / (n - 1)) /
              n,
          );
        this.curve.push({
          samples: n,
          action: this.legal[j],
          mean,
          low: mean - margin,
          high: mean + margin,
        });
      }
      // Keep worker messages and exported studies bounded for large samples.
      if (this.curve.length > 1000)
        this.curve = this.curve.filter(
          (_, i) => Math.floor(i / this.legal.length) % 2 === 0,
        );
    }
    return this.samples >= this.target;
  }
  finish(): AnalysisResult {
    const n = this.samples,
      pool = observablePool(
        this.game.shoe,
        this.game.cursor,
        this.game.dealer,
        this.game.revealed,
      ),
      counts = rankCounts(pool);
    const actions = this.legal.map((action, i) => {
      const ev = n ? this.sums[i] / n : 0,
        s =
          n > 1
            ? Math.sqrt(
                Math.max(
                  0,
                  (this.squares[i] - (this.sums[i] * this.sums[i]) / n) /
                    (n - 1),
                ),
              )
            : 0,
        margin = n > 1 ? (1.96 * s) / Math.sqrt(n) : Infinity;
      return {
        action,
        ev,
        ci95: [ev - margin, ev + margin] as [number, number],
        samples: n,
      };
    });
    let dealer = this.dealerCounts.map((x) => (n ? x / n : 0)),
      dealerMethod: "exact" | "monte-carlo" = "monte-carlo",
      states = 0;
    try {
      const ctx = new CombinatorialContext(
        this.game.rules,
        value(this.game.dealer[0]),
        this.game.rules.holeCard === "peek",
      );
      dealer = ctx.dealer(counts);
      dealerMethod = "exact";
      states = ctx.states;
    } catch (e) {
      if (!(e instanceof AnalysisLimit)) throw e;
    }
    return {
      method: "monte-carlo",
      actions,
      dealer,
      dealerMethod,
      dealerSamples: dealerMethod === "exact" ? 0 : n,
      dealerCI: dealer.map((p) => {
        const m =
          dealerMethod === "exact"
            ? 0
            : 1.96 * Math.sqrt((p * (1 - p)) / Math.max(1, n));
        return [Math.max(0, p - m), Math.min(1, p + m)];
      }),
      insurance: insuranceEV(this.game),
      composition: counts
        .map((cards, v) => ({
          value: v,
          cards,
          probability: pool.length ? cards / pool.length : 0,
        }))
        .filter((x) => x.cards),
      states,
      recommended: [...actions].sort((a, b) => b.ev - a.ev)[0]?.action ?? null,
      samples: n,
      seed: this.seed,
      assumptions:
        "Independent finite-shoe resampling of observable composition, with a hidden-card posterior conditioned on peek. Every candidate uses the same sampled shoe (paired trials). " +
        (this.exactPolicy
          ? "Future actions use the exact optimal observable-state policy from the matching enumeration, including all split hands and bankroll constraints. "
          : "Future actions use the validated basic chart when supported; otherwise explicitly use hit below hard 17/soft 19, stand otherwise. Estimates evaluate this declared continuation policy, not globally optimal future play. ") +
        "Intervals are approximate pointwise 95% normal intervals over independent round trials. EV is net round profit per initial wager.",
      reference: "docs/MATHEMATICS.md",
    };
  }
}
