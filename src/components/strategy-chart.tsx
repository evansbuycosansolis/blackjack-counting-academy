"use client";
import { Card, Rank, evaluate } from "@/engine/cards";
import { Action, Hand } from "@/engine/game";
import { Rules } from "@/engine/rules";
import { basicAction, strategyScope } from "@/engine/strategy";
import { useState } from "react";
const card = (rank: Rank, id: string): Card => ({ rank, suit: "♠", id });
const letters: Record<Action, string> = {
  hit: "H",
  stand: "S",
  double: "D",
  split: "P",
  surrender: "R",
};
export function StrategyChart({ rules }: { rules: Rules }) {
  const [kind, setKind] = useState("Hard totals");
  const totals =
    kind === "Hard totals"
      ? Array.from({ length: 16 }, (_, i) => i + 5)
      : kind === "Soft totals"
        ? Array.from({ length: 8 }, (_, i) => i + 13)
        : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  return (
    <section className="panel">
      <h2>Your rules-specific strategy chart</h2>
      <p>
        H hit · S stand · D double (or hit; soft 18/19 stand if unavailable) · P
        split · R surrender. Assumes all displayed actions are funded and legal.
        US peek excludes dealer blackjack.
      </p>
      <div className="segmented">
        {["Hard totals", "Soft totals", "Pairs"].map((x) => (
          <button
            key={x}
            className={kind === x ? "selected" : ""}
            onClick={() => setKind(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <div className="table-scroll">
        <table className="strategy-chart">
          <thead>
            <tr>
              <th>PLAYER / DEALER</th>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                <th key={n}>{n === 11 ? "A" : n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {totals.map((t) => {
              const pair = kind === "Pairs";
              const rs: Rank[] = pair
                ? [
                    t === 11 ? "A" : (String(t) as Rank),
                    t === 11 ? "A" : (String(t) as Rank),
                  ]
                : kind === "Soft totals"
                  ? ["A", String(t - 11) as Rank]
                  : t <= 11
                    ? ["2", String(t - 2) as Rank]
                    : ["10", String(t - 10) as Rank];
              const h: Hand = {
                cards: rs.map((r, i) => card(r, String(i))),
                bet: 1000,
                original: 1000,
                split: false,
                splitAces: false,
                done: false,
                surrendered: false,
                doubled: false,
              };
              return (
                <tr key={t}>
                  <td>
                    {pair
                      ? t === 11
                        ? "A,A"
                        : `${t},${t}`
                      : kind === "Soft totals"
                        ? `A,${t - 11}`
                        : t}
                  </td>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((d) => {
                    const v = evaluate(h.cards),
                      canDouble =
                        rules.double === "any" ||
                        (!v.soft &&
                          v.total >= (rules.double === "9-11" ? 9 : 10) &&
                          v.total <= 11);
                    const a = basicAction(
                      h,
                      card(d === 11 ? "A" : (String(d) as Rank), "up"),
                      rules,
                      [
                        "hit",
                        "stand",
                        ...(canDouble ? ["double" as const] : []),
                        "split",
                        ...(rules.surrender &&
                        (rules.holeCard === "peek" || d < 10)
                          ? ["surrender" as const]
                          : []),
                      ],
                    );
                    return (
                      <td
                        key={d}
                        className={`action-cell action-${a}`}
                        title={a ?? "Unsupported"}
                      >
                        {a ? letters[a] : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="micro">
        {strategyScope} Limited bankroll and split limits can change available
        action fallbacks at the table.
      </p>
    </section>
  );
}
