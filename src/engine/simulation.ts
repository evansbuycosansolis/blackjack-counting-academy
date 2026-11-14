import { BettingMode, RampRow, wager } from "./betting";
import {
  EdgeBin,
  EdgeModel,
  empiricalKelly,
  legalMinimum,
  rulesKey,
} from "./calibration";
import { seededRandom, trueCount } from "./cards";
import { act, deal, Game, insurance, newGame } from "./game";
import {
  IndexProfile,
  indexPolicyKey,
  selectProfile,
  indexDecision,
} from "./index-profiles";
import { Rules } from "./rules";
import {
  adjusted,
  deviationsSupported,
  recommend,
  strategySupported,
} from "./strategy";
export interface SimulationConfig {
  edgeModel?: EdgeModel;
  indexProfile?: IndexProfile;
  rules: Rules;
  hands: number;
  seed: number;
  bankroll: number;
  mode: BettingMode;
  unit: number;
  ramp: RampRow[];
  kelly: number;
  deviations: boolean;
  stopLoss: number;
  stopWin: number;
}
export interface Point {
  hand: number;
  bankroll: number;
  profit: number;
  drawdown: number;
}
export interface SimulationResult {
  settledHands: number;
  losses: number;
  voids: number;
  edgeModel?: EdgeModel;
  confidenceMethod?: string;
  shoeClusters?: number;
  points: Point[];
  hands: number;
  profit: number;
  wagered: number;
  wins: number;
  pushes: number;
  blackjacks: number;
  maxDrawdown: number;
  averageBet: number;
  maxBet: number;
  averageTC: number;
  volatility: number;
  ci95: [number, number];
  byCount: { tc: number; profit: number; hands: number }[];
  histogram: { range: string; hands: number }[];
  reason: string;
  seed: number;
  config: SimulationConfig;
}
export class Simulator {
  g: Game;
  rng: () => number;
  result: SimulationResult;
  high: number;
  sum = 0;
  sumSq = 0;
  tcSum = 0;
  initialWagers = 0;
  bins = new Map<number, { profit: number; hands: number }>();
  outcomes = new Map<number, number>();
  clusters: {
    profit: number;
    rounds: number;
    byCount: Map<
      number,
      { sum: number; squares: number; n: number; outcomes: Map<number, number> }
    >;
  }[] = [];
  cluster = {
    profit: 0,
    rounds: 0,
    byCount: new Map<
      number,
      { sum: number; squares: number; n: number; outcomes: Map<number, number> }
    >(),
  };
  constructor(public config: SimulationConfig) {
    if (
      !Number.isInteger(config.hands) ||
      config.hands < 1 ||
      config.hands > 1000000 ||
      !Number.isInteger(config.seed) ||
      !Number.isFinite(config.bankroll) ||
      config.bankroll < 0 ||
      !Number.isInteger(config.unit) ||
      config.unit < 1 ||
      config.kelly <= 0 ||
      config.kelly > 1 ||
      config.stopLoss < 0 ||
      config.stopWin < 0
    )
      throw Error("Invalid simulation configuration");
    if (
      config.mode === "kelly" &&
      (!config.edgeModel ||
        config.edgeModel.rulesKey !== rulesKey(config.rules) ||
        config.edgeModel.policy !==
          (config.deviations
            ? indexPolicyKey(config.indexProfile ?? selectProfile(config.rules))
            : "basic"))
    )
      throw Error("Kelly calibration must match the rules and playing policy.");
    if (!strategySupported(config.rules))
      throw Error("Simulation requires a supported basic strategy ruleset.");
    if (
      config.deviations &&
      !deviationsSupported(config.rules, config.indexProfile)
    )
      throw Error("Index table requires six-deck S17, DAS and US peek.");
    this.rng = seededRandom(config.seed);
    this.g = newGame(config.rules, config.bankroll * 100, this.rng);
    this.high = config.bankroll;
    this.result = {
      points: [{ hand: 0, bankroll: config.bankroll, profit: 0, drawdown: 0 }],
      settledHands: 0,
      losses: 0,
      voids: 0,
      hands: 0,
      profit: 0,
      wagered: 0,
      wins: 0,
      pushes: 0,
      blackjacks: 0,
      maxDrawdown: 0,
      averageBet: 0,
      maxBet: 0,
      averageTC: 0,
      volatility: 0,
      ci95: [0, 0],
      byCount: [],
      histogram: [],
      reason: "",
      seed: config.seed,
      config,
    };
  }
  step(count = 1000) {
    const c = this.config,
      r = this.result;
    for (let i = 0; i < count && r.hands < c.hands && !r.reason; i++) {
      const tc =
        this.g.cursor >= Math.floor(this.g.shoe.length * c.rules.penetration)
          ? 0
          : trueCount(
              this.g.running,
              this.g.shoe.length - this.g.cursor,
              c.rules.countPrecision,
              c.rules.countRounding,
            ).index;
      const bet = wager(
        c.mode,
        tc,
        this.g.bankroll / 100,
        c.rules,
        c.unit,
        c.ramp,
        c.kelly,
        c.edgeModel,
      );
      if (bet < legalMinimum(c.rules)) {
        r.reason = "Bankroll below table minimum";
        break;
      }
      const previousShuffle = this.g.shuffles;
      this.g = deal(this.g, bet, this.rng, true);
      if (this.g.shuffles !== previousShuffle && this.cluster.rounds) {
        this.clusters.push(this.cluster);
        this.cluster = { profit: 0, rounds: 0, byCount: new Map() };
      }
      if (this.g.phase === "insurance") {
        const profile = c.indexProfile ?? selectProfile(c.rules),
          entry = profile?.entries.find((x) => x.above === "insurance"),
          insuranceCount = trueCount(
            this.g.running,
            this.g.shoe.length - this.g.cursor,
            c.rules.countPrecision,
            c.rules.countRounding,
          ).index;
        this.g = insurance(
          this.g,
          c.deviations &&
            !!entry &&
            indexDecision(entry, insuranceCount, this.g.running) ===
              "insurance" &&
            this.g.bankroll >= this.g.initialBet / 2,
        );
      }
      let guard = 0;
      while (this.g.phase === "playing") {
        if (++guard > 200) throw Error("Round did not terminate");
        const a = c.deviations
          ? adjusted(this.g, undefined, c.indexProfile)
          : recommend(this.g);
        if (!a) throw Error("Unsupported strategy");
        this.g = act(this.g, a, true);
      }
      const p = (this.g.bankroll - this.g.roundStart) / 100;
      this.sum += p;
      this.sumSq += p * p;
      this.cluster.profit += p;
      this.cluster.rounds++;
      const countBin = Math.max(-10, Math.min(10, tc)),
        cb = this.cluster.byCount.get(countBin) ?? {
          sum: 0,
          squares: 0,
          n: 0,
          outcomes: new Map<number, number>(),
        },
        unitReturn = p / bet;
      cb.sum += unitReturn;
      cb.squares += unitReturn * unitReturn;
      cb.n++;
      cb.outcomes.set(unitReturn, (cb.outcomes.get(unitReturn) ?? 0) + 1);
      this.cluster.byCount.set(countBin, cb);
      r.hands++;
      r.profit = this.g.bankroll / 100 - c.bankroll;
      r.wagered += this.g.wagerCount / 100;
      this.initialWagers += bet;
      this.tcSum += tc;
      r.maxBet = Math.max(r.maxBet, bet);
      for (const h of this.g.hands) {
        r.settledHands++;
        if (h.result === "Void") r.voids++;
        else if (!["Win", "Blackjack", "Push"].includes(h.result ?? ""))
          r.losses++;
        if (["Win", "Blackjack"].includes(h.result ?? "")) r.wins++;
        if (h.result === "Push") r.pushes++;
        if (h.result === "Blackjack") r.blackjacks++;
      }
      this.high = Math.max(this.high, this.g.bankroll / 100);
      const dd = this.high - this.g.bankroll / 100;
      r.maxDrawdown = Math.max(r.maxDrawdown, dd);
      const bin = Math.max(-10, Math.min(10, tc)),
        b = this.bins.get(bin) ?? { profit: 0, hands: 0 };
      b.profit += p;
      b.hands++;
      this.bins.set(bin, b);
      const outcome = Math.round(p / c.unit);
      this.outcomes.set(outcome, (this.outcomes.get(outcome) ?? 0) + 1);
      if (r.hands % Math.max(1, Math.floor(c.hands / 1000)) === 0)
        r.points.push({
          hand: r.hands,
          bankroll: this.g.bankroll / 100,
          profit: r.profit,
          drawdown: dd,
        });
      if (c.stopLoss > 0 && r.profit <= -c.stopLoss)
        r.reason = "Stop-loss reached";
      if (c.stopWin > 0 && r.profit >= c.stopWin) r.reason = "Stop-win reached";
    }
    return r.hands >= c.hands || !!r.reason;
  }
  finish(reason?: string) {
    const r = this.result,
      n = r.hands;
    r.reason = reason || r.reason || "Completed";
    r.averageBet = n ? this.initialWagers / n : 0;
    r.averageTC = n ? this.tcSum / n : 0;
    r.volatility =
      n > 1
        ? Math.sqrt(
            Math.max(0, (this.sumSq - (this.sum * this.sum) / n) / (n - 1)),
          )
        : 0;
    const clusters = [
        ...this.clusters,
        ...(this.cluster.rounds ? [this.cluster] : []),
      ],
      mean = n ? this.sum / n : 0,
      k = clusters.length;
    const se =
      k > 1
        ? Math.sqrt(
            (k / (k - 1)) *
              clusters.reduce(
                (s, c) => s + (c.profit - mean * c.rounds) ** 2,
                0,
              ),
          ) / n
        : 0;
    r.ci95 = k > 1 ? [mean - 1.96 * se, mean + 1.96 * se] : [NaN, NaN];
    r.shoeClusters = k;
    r.confidenceMethod =
      "Approximate 95% shoe-cluster sandwich interval; fewer than two shoes gives no interval. Bankroll-dependent betting and optional stopping limit interpretation; use independent-session bootstrap for risk conclusions.";
    if (this.config.mode === "flat") {
      const bins: EdgeBin[] = [];
      for (let tc = -10; tc <= 10; tc++) {
        const rows = clusters
            .map((c) => c.byCount.get(tc))
            .filter((x): x is NonNullable<typeof x> => !!x),
          samples = rows.reduce((s, x) => s + x.n, 0);
        if (!samples) continue;
        const m = rows.reduce((s, x) => s + x.sum, 0) / samples,
          shoes = rows.length,
          stderr =
            shoes > 1
              ? Math.sqrt(
                  (shoes / (shoes - 1)) *
                    rows.reduce((s, x) => s + (x.sum - m * x.n) ** 2, 0),
                ) / samples
              : NaN,
          outcomes = new Map<number, number>();
        for (const row of rows)
          for (const [v, amount] of row.outcomes)
            outcomes.set(v, (outcomes.get(v) ?? 0) + amount);
        const values = [...outcomes].map(([value, count]) => ({
          value,
          count,
        }));
        bins.push({
          tc,
          samples,
          shoes,
          mean: m,
          ci95: [m - 1.96 * stderr, m + 1.96 * stderr],
          secondMoment: rows.reduce((s, x) => s + x.squares, 0) / samples,
          kellyFraction: empiricalKelly(values),
          outcomes: values,
        });
      }
      r.edgeModel = {
        id: `calibration-${this.config.seed}-${n}`,
        rulesKey: rulesKey(this.config.rules),
        policy: this.config.deviations
          ? indexPolicyKey(
              this.config.indexProfile ?? selectProfile(this.config.rules),
            )
          : "basic",
        seed: this.config.seed,
        rounds: n,
        bins,
        method:
          "Observed unit-return distribution from flat betting under the selected rules and full playing-policy signature. Edge intervals cluster whole shoes. Empirical Kelly maximizes log growth over each sampled outcome distribution by bisection, then applies the chosen fraction. Population edge and tail risk remain uncertain; sparse bins use a declared fixed-unit fallback rather than a generic count-to-edge formula.",
      };
    }
    r.byCount = [...this.bins.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([tc, b]) => ({ tc, ...b }));
    r.histogram = [...this.outcomes.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([u, hands]) => ({ range: `${u}u`, hands }));
    if (r.points.at(-1)?.hand !== n)
      r.points.push({
        hand: n,
        bankroll: this.g.bankroll / 100,
        profit: r.profit,
        drawdown: this.high - this.g.bankroll / 100,
      });
    return r;
  }
}
