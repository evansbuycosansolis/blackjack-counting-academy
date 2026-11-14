import type { Action } from "./game";
export interface Deviation {
  hand: number;
  dealer: number;
  index: number;
  above: Action | "insurance";
  below: Action;
  pair?: boolean;
  set: "I18" | "F4";
}
export const deviations: Deviation[] = [
  {
    hand: 0,
    dealer: 11,
    index: 3,
    above: "insurance",
    below: "stand",
    set: "I18",
  },
  ...(
    [
      [16, 10, 0],
      [15, 10, 4],
      [12, 3, 2],
      [12, 2, 3],
      [16, 9, 5],
      [13, 2, -1],
      [12, 4, 0],
      [12, 5, -2],
      [12, 6, -1],
      [13, 3, -2],
    ] as number[][]
  ).map(([hand, dealer, index]) => ({
    hand,
    dealer,
    index,
    above: "stand" as const,
    below: "hit" as const,
    set: "I18" as const,
  })),
  ...(
    [
      [10, 10, 4],
      [11, 11, 1],
      [9, 2, 1],
      [10, 11, 4],
      [9, 7, 3],
    ] as number[][]
  ).map(([hand, dealer, index]) => ({
    hand,
    dealer,
    index,
    above: "double" as const,
    below: "hit" as const,
    set: "I18" as const,
  })),
  ...(
    [
      [20, 5, 5],
      [20, 6, 4],
    ] as number[][]
  ).map(([hand, dealer, index]) => ({
    hand,
    dealer,
    index,
    above: "split" as const,
    below: "stand" as const,
    pair: true,
    set: "I18" as const,
  })),
  ...(
    [
      [14, 10, 3],
      [15, 10, 0],
      [15, 9, 2],
      [15, 11, 1],
    ] as number[][]
  ).map(([hand, dealer, index]) => ({
    hand,
    dealer,
    index,
    above: "surrender" as const,
    below: "hit" as const,
    set: "F4" as const,
  })),
];
