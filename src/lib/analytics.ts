import { Game } from "@/engine/game";
export interface RoundRecord {
  betAssessment?: {
    actual: number;
    recommended: number;
    correct: boolean;
    method: string;
    tc: number;
  };
  id: string;
  session: string;
  date: string;
  round: number;
  bankroll: number;
  profit: number;
  wager: number;
  tc: number;
  results: string[];
  decisions: Game["decisions"];
  rules: Game["rules"];
  duration: number;
}
export function summarize(records: RoundRecord[]) {
  const profit = records.reduce((s, r) => s + r.profit, 0),
    wager = records.reduce((s, r) => s + r.wager, 0),
    decisions = records
      .flatMap((r) => r.decisions)
      .filter((d) => d.recommended),
    correct = decisions.filter((d) => d.action === d.recommended).length;
  const results = records.flatMap((r) => r.results);
  let high = records[0] ? records[0].bankroll - records[0].profit : 100000,
    drawdown = 0,
    previousSession = "";
  for (const r of records) {
    if (r.session !== previousSession) high = r.bankroll - r.profit;
    previousSession = r.session;
    high = Math.max(high, r.bankroll);
    drawdown = Math.max(drawdown, high - r.bankroll);
  }
  return {
    profit,
    wager,
    accuracy: decisions.length ? correct / decisions.length : null,
    decisionCount: decisions.length,
    hands: results.length,
    wins: results.filter((r) => ["Win", "Blackjack", "Even money"].includes(r))
      .length,
    losses: results.filter((r) =>
      ["Loss", "Bust", "Dealer blackjack", "Surrender"].includes(r),
    ).length,
    pushes: results.filter((r) => r === "Push").length,
    blackjacks: results.filter((r) => r === "Blackjack").length,
    drawdown,
    roi: wager ? profit / wager : 0,
    sessions: new Set(records.map((r) => r.session)).size,
  };
}
export function download(data: unknown, name: string, csv = false) {
  const body = csv ? String(data) : JSON.stringify(data, null, 2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([body], { type: csv ? "text/csv" : "application/json" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
