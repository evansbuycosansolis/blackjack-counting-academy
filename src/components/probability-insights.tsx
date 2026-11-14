"use client";
import { Game } from "@/engine/game";
import {
  conditionedHitBust,
  dealerBustEstimate,
  observablePool,
} from "@/engine/probabilities";
import { Info } from "lucide-react";
import { useMemo } from "react";

import { AnalysisLauncher } from "./action-analysis";
export function ProbabilityInsights({ game: g }: { game: Game }) {
  const p = useMemo(() => {
    const pool = observablePool(g.shoe, g.cursor, g.dealer, g.revealed),
      peek = g.rules.holeCard === "peek";
    return {
      hit: conditionedHitBust(g.hands[g.active].cards, pool, g.dealer[0], peek),
      dealer: dealerBustEstimate(g.dealer[0], pool, g.rules.hitSoft17, peek),
    };
  }, [g]);

  return (
    <section className="rail-card probability-insights">
      <AnalysisLauncher />
      <div className="rail-title">
        <h2>
          <Info size={16} /> Probability insights
        </h2>
      </div>
      <div className="count-facts">
        <div>
          <span>Bust if you hit</span>
          <b>{(p.hit * 100).toFixed(1)}%</b>
        </div>
        <div>
          <span>Dealer bust if you stand</span>
          <b>{(p.dealer.probability * 100).toFixed(1)}%</b>
        </div>
        <div>
          <span>Fresh-shoe natural</span>
          <b>
            {(
              ((2 * (4 * g.rules.decks) * (16 * g.rules.decks)) /
                (52 * g.rules.decks * (52 * g.rules.decks - 1))) *
              100
            ).toFixed(2)}
            %
          </b>
        </div>
      </div>
      <p className="micro">
        Hit fraction: exact observable composition, conditional on US peek when
        applicable. Dealer: {p.dealer.samples.toLocaleString()} samples, ±
        {(p.dealer.margin * 100).toFixed(1)} percentage points (approx. 95%). No
        future player draws assumed.
      </p>
    </section>
  );
}
