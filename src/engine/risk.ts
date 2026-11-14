import { legalMinimum } from "./calibration";
import { seededRandom } from "./cards";
import { SimulationConfig, Simulator } from "./simulation";
import {
  bootstrapMeanCI,
  derivedSeed,
  histogram,
  mean,
  quantile,
  wilson,
} from "./statistics";
export interface RiskConfig {
  sessions: number;
  seed: number;
  strategies: { name: string; config: SimulationConfig }[];
}
export interface SessionOutcome {
  strategy: number;
  session: number;
  seed: number;
  rounds: number;
  finalBankroll: number;
  profit: number;
  drawdown: number;
  ruined: boolean;
  reason: string;
}
export interface RiskSummary {
  name: string;
  sessions: number;
  ruinProbability: number;
  ruinCI: [number, number];
  survivalProbability: number;
  survivalCI: [number, number];
  meanProfit: number;
  profitCI: [number, number];
  medianBankroll: number;
  bankrollQuantiles: { p: number; value: number }[];
  finalDistribution: ReturnType<typeof histogram>;
  drawdownDistribution: ReturnType<typeof histogram>;
  meanDrawdown: number;
  stopped: number;
  survival: { round: number; probability: number; ci: [number, number] }[];
}
export interface RiskResult {
  config: RiskConfig;
  outcomes: SessionOutcome[];
  summaries: RiskSummary[];
  comparisons: {
    name: string;
    meanDifference: number;
    ci: [number, number];
    pairs: number;
  }[];
  cancelled: boolean;
  method: string;
}
export class RiskStudy {
  outcomes: SessionOutcome[] = [];
  current: Simulator | null = null;
  strategy = 0;
  session = 0;
  completed = 0;
  constructor(public config: RiskConfig) {
    if (
      !Number.isInteger(config.sessions) ||
      config.sessions < 1 ||
      config.sessions > 10000 ||
      config.strategies.length < 1 ||
      config.strategies.length > 5
    )
      throw Error("Risk study needs 1–10,000 sessions and 1–5 strategies.");
  }
  step(batch = 500) {
    if (this.session >= this.config.sessions) return true;
    if (!this.current) {
      const c = this.config.strategies[this.strategy].config;
      this.current = new Simulator({
        ...c,
        seed: derivedSeed(this.config.seed, this.session),
      });
    }
    if (this.current.step(batch)) {
      const r = this.current.finish(),
        bank = r.config.bankroll + r.profit;
      this.outcomes.push({
        strategy: this.strategy,
        session: this.session,
        seed: r.seed,
        rounds: r.hands,
        finalBankroll: bank,
        profit: r.profit,
        drawdown: r.maxDrawdown,
        ruined: bank < legalMinimum(r.config.rules),
        reason: r.reason,
      });
      this.current = null;
      this.completed++;
      this.strategy++;
      if (this.strategy >= this.config.strategies.length) {
        this.strategy = 0;
        this.session++;
      }
    }
    return this.session >= this.config.sessions;
  }
  finish(cancelled = false): RiskResult {
    const summaries = this.config.strategies.map((strategy, j) => {
      const rows = this.outcomes.filter((r) => r.strategy === j),
        n = rows.length,
        ruined = rows.filter((r) => r.ruined).length,
        ruinCI = wilson(ruined, n),
        rng = seededRandom(derivedSeed(this.config.seed, j + 10000)),
        profits = rows.map((r) => r.profit),
        horizon = strategy.config.hands;
      return {
        name: strategy.name,
        sessions: n,
        ruinProbability: n ? ruined / n : 0,
        ruinCI,
        survivalProbability: n ? 1 - ruined / n : 0,
        survivalCI: [1 - ruinCI[1], 1 - ruinCI[0]] as [number, number],
        meanProfit: mean(profits),
        profitCI: bootstrapMeanCI(profits, rng),
        medianBankroll: quantile(
          rows.map((r) => r.finalBankroll),
          0.5,
        ),
        bankrollQuantiles: [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => ({
          p,
          value: quantile(
            rows.map((r) => r.finalBankroll),
            p,
          ),
        })),
        finalDistribution: histogram(rows.map((r) => r.finalBankroll)),
        drawdownDistribution: histogram(rows.map((r) => r.drawdown)),
        meanDrawdown: mean(rows.map((r) => r.drawdown)),
        stopped: rows.filter(
          (r) =>
            r.reason === "Stop-loss reached" || r.reason === "Stop-win reached",
        ).length,
        survival: Array.from({ length: 11 }, (_, i) => {
          const round = Math.floor((horizon * i) / 10),
            alive = rows.filter((r) => !r.ruined || r.rounds > round).length;
          return {
            round,
            probability: n ? alive / n : 0,
            ci: wilson(alive, n),
          };
        }),
      };
    });
    const paired = new Map(
      this.outcomes.map((r) => [`${r.strategy}:${r.session}`, r]),
    );
    const comparisons = this.config.strategies.slice(1).map((s, k) => {
      const strategy = k + 1,
        differences: number[] = [];
      for (let i = 0; i < this.config.sessions; i++) {
        const base = paired.get(`0:${i}`),
          other = paired.get(`${strategy}:${i}`);
        if (base && other) differences.push(other.profit - base.profit);
      }
      return {
        name: `${s.name} minus ${this.config.strategies[0].name}`,
        meanDifference: mean(differences),
        ci: bootstrapMeanCI(
          differences,
          seededRandom(derivedSeed(this.config.seed, 20000 + strategy)),
        ),
        pairs: differences.length,
      };
    });
    return {
      config: this.config,
      outcomes: this.outcomes,
      summaries,
      comparisons,
      cancelled,
      method:
        "Fresh shoe and derived PRNG seed per independent session; within-session shoes persist. Ruin means bankroll below table minimum, not necessarily zero. Wilson 95% binomial intervals for ruin/survival; percentile bootstrap 95% mean-profit intervals resample whole independent sessions, preserving all within-shoe hand dependence. Comparisons pair sessions by seed and bootstrap their profit differences. Stop-loss/win rules are part of the stopping policy. Zero observed ruins does not establish zero true risk.",
    };
  }
}
