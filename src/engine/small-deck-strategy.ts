import { Card, value } from "./cards";
import type { Action, Hand } from "./game";
import type { Rules } from "./rules";
// Published, total-dependent chart cells, independently transcribed from the
// author's single/double deck S17/H17 charts. Cell order: dealer 2..10,A.
type Cell =
  "H" | "S" | "Dh" | "Ds" | "P" | "Ph" | "Pd" | "Rh" | "Rs" | "Rp" | "Ps";
const row = (s: string) => s.split(" ") as Cell[];
const singleSoft: Record<number, Cell[]> = {
  13: row("H H H Dh Dh H H H H H"),
  14: row("H H Dh Dh Dh H H H H H"),
  15: row("H H Dh Dh Dh H H H H H"),
  16: row("H H Dh Dh Dh H H H H H"),
  17: row("Dh Dh Dh Dh Dh H H H H H"),
  18: row("S Ds Ds Ds Ds S S H H S"),
  19: row("S S S S Ds S S S S S"),
};
const doubleSoft: Record<number, Cell[]> = {
  13: row("H H H Dh Dh H H H H H"),
  14: row("H H Dh Dh Dh H H H H H"),
  15: row("H H Dh Dh Dh H H H H H"),
  16: row("H H Dh Dh Dh H H H H H"),
  17: row("H Dh Dh Dh Dh H H H H H"),
  18: row("S Ds Ds Ds Ds S S H H S"),
};
export function smallDeckChart(
  h: Hand,
  up: Card,
  r: Rules,
  allowed: Action[],
): Action {
  const d = value(up),
    i = d === 11 ? 9 : d - 2,
    can = (a: Action) => allowed.includes(a);
  let total = h.cards.reduce((n, c) => n + value(c), 0),
    aces = h.cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  const pair =
    h.cards.length === 2 && value(h.cards[0]) === value(h.cards[1])
      ? value(h.cards[0])
      : 0;
  const cell = (c: Cell): Action => {
    switch (c) {
      case "H":
        return "hit";
      case "S":
        return "stand";
      case "Dh":
        return can("double") ? "double" : "hit";
      case "Ds":
        return can("double") ? "double" : "stand";
      case "P":
        return can("split") ? "split" : base();
      case "Ps":
        return can("split") && r.das ? "split" : "stand";
      case "Ph":
        return can("split") && r.das ? "split" : "hit";
      case "Pd":
        return can("split") && r.das
          ? "split"
          : can("double")
            ? "double"
            : "hit";
      case "Rh":
        return can("surrender") ? "surrender" : "hit";
      case "Rs":
        return can("surrender") ? "surrender" : "stand";
      case "Rp":
        return can("surrender") ? "surrender" : can("split") ? "split" : base();
    }
  };
  function base(): Action {
    if (h.splitAces && !r.hitSplitAces) return "stand";
    if (aces) {
      if (total >= 20) return "stand";
      if (r.decks === 1) {
        if (total === 18 && r.hitSoft17 && d === 11) return "hit";
        return cell(singleSoft[total]?.[i] ?? "S");
      }
      if (total === 18 && r.hitSoft17 && d === 2) return cell("Ds");
      if (total === 18 && r.hitSoft17 && d === 11) return "hit";
      if (total === 19 && r.hitSoft17 && d === 6) return cell("Ds");
      return cell(doubleSoft[total]?.[i] ?? "S");
    }
    if (total >= 17)
      return total === 17 && r.hitSoft17 && d === 11 ? cell("Rs") : "stand";
    if (total === 16 && [10, 11].includes(d)) return cell("Rh");
    if (
      total === 15 &&
      ((r.decks === 2 && d === 10) || (r.hitSoft17 && d === 11))
    )
      return cell("Rh");
    if (total >= 13) return d <= 6 ? "stand" : "hit";
    if (total === 12) return d >= 4 && d <= 6 ? "stand" : "hit";
    if (total === 11) return cell("Dh");
    if (total === 10) return d <= 9 ? cell("Dh") : "hit";
    if (total === 9) return d <= 6 ? cell("Dh") : "hit";
    if (total === 8 && r.decks === 1 && [5, 6].includes(d)) return cell("Dh");
    return "hit";
  }
  if (pair && can("split")) {
    if (pair === 11 || pair === 8) {
      if (pair === 8 && r.decks === 2 && r.hitSoft17 && d === 11)
        return cell("Rp");
      return "split";
    }
    if (pair === 2)
      return cell(
        row(r.decks === 1 ? "Ph P P P P P H H H H" : "Ph Ph P P P P H H H H")[
          i
        ],
      );
    if (pair === 3)
      return cell(
        row(r.decks === 1 ? "Ph Ph P P P P Ph H H H" : "Ph Ph P P P P H H H H")[
          i
        ],
      );
    if (pair === 4)
      return cell(
        row(r.decks === 1 ? "H H H Pd Pd H H H H H" : "H H H Ph Ph H H H H H")[
          i
        ],
      );
    if (pair === 6)
      return cell(
        row(r.decks === 1 ? "P P P P P Ph H H H H" : "P P P P P H H H H H")[i],
      );
    if (pair === 7) {
      if (r.decks === 1 && d === 11 && r.hitSoft17) return cell("Rh");
      if (r.decks === 1 && d === 10) return cell("Rs");
      return cell(
        row(r.decks === 1 ? "P P P P P P Ph H Rs H" : "P P P P P P H H H H")[i],
      );
    }
    if (pair === 9) {
      if (r.decks === 1 && r.hitSoft17 && d === 11) return cell("Ps");
      return [2, 3, 4, 5, 6, 8, 9].includes(d) ? "split" : "stand";
    }
  }
  return base();
}
