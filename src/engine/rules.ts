export interface Rules {
  betIncrement?: number;
  countPrecision: 0.25 | 0.5 | 1;
  countRounding: "floor" | "truncate" | "round";
  decks: 1 | 2 | 4 | 6 | 8;
  hitSoft17: boolean;
  payout: "3:2" | "6:5";
  das: boolean;
  double: "any" | "9-11" | "10-11";
  maxHands: number;
  resplitAces: boolean;
  hitSplitAces: boolean;
  surrender: boolean;
  insurance: boolean;
  holeCard: "peek" | "no-peek" | "european";
  dealerBlackjackLoss: "all" | "original";
  penetration: number;
  min: number;
  max: number;
}
export const defaultRules: Rules = {
  betIncrement: 1,
  countPrecision: 0.5,
  countRounding: "floor",
  decks: 6,
  hitSoft17: false,
  payout: "3:2",
  das: true,
  double: "any",
  maxHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  surrender: true,
  insurance: true,
  holeCard: "peek",
  dealerBlackjackLoss: "all",
  penetration: 0.75,
  min: 10,
  max: 500,
};
export const presets: Record<string, Rules> = {
  "Beginner Practice": { ...defaultRules, decks: 6, penetration: 0.5 },
  "Common Six-Deck Casino": { ...defaultRules },
  "Advanced Rules Configuration": {
    ...defaultRules,
    hitSoft17: true,
    holeCard: "european",
    surrender: false,
    payout: "6:5",
    penetration: 0.8,
  },
};
export function validateRules(r: Rules) {
  if (
    ![1, 2, 4, 6, 8].includes(r.decks) ||
    !Number.isFinite(r.penetration) ||
    ![
      "hitSoft17",
      "das",
      "resplitAces",
      "hitSplitAces",
      "surrender",
      "insurance",
    ].every((k) => typeof r[k as keyof Rules] === "boolean") ||
    !Number.isInteger(r.betIncrement ?? 1) ||
    (r.betIncrement ?? 1) < 1 ||
    Math.ceil(r.min / (r.betIncrement ?? 1)) * (r.betIncrement ?? 1) > r.max ||
    ![0.25, 0.5, 1].includes(r.countPrecision ?? 0.5) ||
    !["floor", "truncate", "round"].includes(r.countRounding ?? "floor") ||
    !["3:2", "6:5"].includes(r.payout) ||
    !["any", "9-11", "10-11"].includes(r.double) ||
    !["peek", "no-peek", "european"].includes(r.holeCard) ||
    !["all", "original"].includes(r.dealerBlackjackLoss) ||
    r.penetration < 0.5 ||
    r.penetration > 0.9 ||
    !Number.isInteger(r.min) ||
    r.min < 1 ||
    !Number.isInteger(r.max) ||
    r.max < r.min ||
    r.max > 1000000000 ||
    ![2, 3, 4].includes(r.maxHands)
  )
    throw Error("Invalid casino rules. Check limits, decks and penetration.");
}
export const ruleSummary = (r: Rules) =>
  `${r.decks} decks · ${r.hitSoft17 ? "H17" : "S17"} · ${r.payout} · ${r.das ? "DAS" : "No DAS"} · ${r.holeCard} · ${Math.round(r.penetration * 100)}% penetration`;
