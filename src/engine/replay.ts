import { Card, hilo, trueCount } from "./cards";
import type { Game, Hand } from "./game";
export interface ReplayFrame {
  phase: Game["phase"];
  dealer: Card[];
  revealed: boolean;
  hands: Hand[];
  active: number;
  bankroll: number;
  roundStart: number;
  initialBet: number;
  insuranceBet: number;
  running: number;
  trueCount: number;
  remaining: number;
  seen: number;
  shuffles: number;
  round: number;
  message: string;
}
export interface RoundEvent {
  step: number;
  kind: string;
  running: number;
  trueCount: number;
  remaining: number;
  seen: number;
  shuffles: number;
  card?: Card;
  visible?: boolean;
  owner?: number | "dealer";
  frame?: ReplayFrame;
}
export function frameOf(g: Game): ReplayFrame {
  return {
    phase: g.phase,
    dealer: [...g.dealer],
    revealed: g.revealed,
    hands: g.hands.map((h) => ({ ...h, cards: [...h.cards] })),
    active: g.active,
    bankroll: g.bankroll,
    roundStart: g.roundStart,
    initialBet: g.initialBet,
    insuranceBet: g.insuranceBet,
    running: g.running,
    trueCount: trueCount(
      g.running,
      g.shoe.length - g.cursor,
      g.rules.countPrecision,
      g.rules.countRounding,
    ).index,
    remaining: g.shoe.length - g.cursor,
    seen: g.seen,
    shuffles: g.shuffles,
    round: g.round,
    message: g.message,
  };
}
export function recordEvent(
  g: Game,
  kind: string,
  data: Partial<RoundEvent> = {},
) {
  if (!g.recordEvents) return;
  g.events ??= [];
  g.events.push({
    step: g.events.length,
    kind,
    running: g.running,
    trueCount: trueCount(
      g.running,
      g.shoe.length - g.cursor,
      g.rules.countPrecision,
      g.rules.countRounding,
    ).index,
    remaining: g.shoe.length - g.cursor,
    seen: g.seen,
    shuffles: g.shuffles,
    ...data,
  });
}
export function recordFrame(g: Game, kind: string) {
  if (g.recordEvents) recordEvent(g, kind, { frame: frameOf(g) });
}
export function reconstructCounts(events: RoundEvent[]) {
  if (!events.length) return [];
  let rc = events[0].kind === "shuffle" ? 0 : events[0].running;
  return events.map((e, i) => {
    if (e.kind === "shuffle") rc = 0;
    else if (
      i > 0 &&
      (e.kind === "draw" || e.kind === "reveal") &&
      e.visible &&
      e.card
    )
      rc += hilo(e.card);
    return {
      step: e.step,
      running: rc,
      recorded: e.running,
      valid: rc === e.running,
    };
  });
}
export function replayFrames(events: RoundEvent[]) {
  let current: ReplayFrame | undefined;
  return events.map((e) => {
    if (e.frame) current = structuredClone(e.frame);
    else if (current) {
      current = {
        ...current,
        running: e.running,
        trueCount: e.trueCount,
        seen: e.seen,
        remaining: e.remaining,
        shuffles: e.shuffles,
        dealer: [...current.dealer],
        hands: current.hands.map((h) => ({ ...h, cards: [...h.cards] })),
      };
      if (e.kind === "draw" && e.card) {
        if (e.owner === "dealer") current.dealer.push(e.card);
        else if (typeof e.owner === "number" && current.hands[e.owner])
          current.hands[e.owner].cards.push(e.card);
      }
      if (e.kind === "reveal") current.revealed = true;
    }
    return { event: e, frame: current ? structuredClone(current) : undefined };
  });
}
