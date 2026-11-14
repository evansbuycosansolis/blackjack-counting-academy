import { evaluate, trueCount, value } from "./cards";
import { legalActions, type Action, type Game } from "./game";
import { deviations } from "./indices-data";
import { defaultRules, validateRules, type Rules } from "./rules";
export type IndexAction = Action | "insurance" | "decline";
export interface IndexRule {
  id: string;
  hand: number;
  dealer: number;
  index: number;
  above: IndexAction;
  below: IndexAction;
  soft?: boolean;
  pair?: boolean;
  trigger?: "gte" | "lte" | "rc-positive" | "rc-negative";
  set: "I18" | "F4" | "Extended";
  explanation: string;
}
export interface IndexProfile {
  id: string;
  name: string;
  validated: boolean;
  source: string;
  rules: Partial<Rules>;
  precision: number;
  rounding: Rules["countRounding"];
  entries: IndexRule[];
}
const common = {
  decks: 6 as const,
  holeCard: "peek" as const,
  das: true,
  double: "any" as const,
  maxHands: 4,
  hitSplitAces: false,
  resplitAces: false,
};
const conventional: IndexProfile = {
  id: "i18-s17",
  name: "Six-deck S17 · conventional I18 / Fab 4",
  validated: true,
  source: "https://wizardofodds.com/games/blackjack/card-counting/high-low/",
  rules: { ...common, hitSoft17: false },
  precision: 0.5,
  rounding: "floor",
  entries: deviations.map((x, i) => ({
    ...x,
    id: `i18-${i}`,
    below: x.hand === 0 ? "decline" : x.below,
    explanation: `${x.above} at or above TC ${x.index}; otherwise ${x.hand === 0 ? "decline" : x.below}. Requires matching rules and a legal action.`,
  })),
};
const positiveRows: [
  number,
  number,
  number,
  IndexAction,
  IndexAction,
  boolean?,
  boolean?,
][] = [
  [0, 11, 3, "insurance", "decline"],
  [16, 10, 0, "stand", "hit"],
  [16, 9, 4, "stand", "hit"],
  [16, 11, 3, "stand", "hit"],
  [15, 10, 4, "stand", "hit"],
  [15, 11, 5, "stand", "hit"],
  [12, 2, 3, "stand", "hit"],
  [12, 3, 2, "stand", "hit"],
  [10, 10, 4, "double", "hit"],
  [10, 11, 3, "double", "hit"],
  [9, 2, 1, "double", "hit"],
  [9, 7, 3, "double", "hit"],
  [8, 6, 2, "double", "hit"],
  [20, 4, 6, "split", "stand", false, true],
  [20, 5, 5, "split", "stand", false, true],
  [20, 6, 4, "split", "stand", false, true],
  [19, 4, 3, "double", "stand", true],
  [19, 5, 1, "double", "stand", true],
  [17, 2, 1, "double", "hit", true],
];
const h17: IndexProfile = {
  id: "bja-h17",
  name: "Six-deck H17 · complete published BJA study table",
  validated: true,
  source:
    "https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf",
  rules: { ...common, hitSoft17: true },
  precision: 0.5,
  rounding: "truncate",
  entries: [
    ...positiveRows.map<IndexRule>(
      ([hand, dealer, index, above, below, soft, pair], i) => ({
        id: `h17-${i}`,
        hand,
        dealer,
        index,
        above,
        below,
        soft,
        pair,
        trigger: hand === 16 && dealer === 10 ? "rc-positive" : "gte",
        set: "Extended",
        explanation:
          hand === 16 && dealer === 10
            ? "BJA uses a strictly positive running count for this zero-index play."
            : `H17: ${above} at TC ${index} or higher, otherwise ${below}.`,
      }),
    ),
    {
      id: "h17-soft19-6",
      hand: 19,
      dealer: 6,
      index: 0,
      above: "stand",
      below: "double",
      soft: true,
      trigger: "rc-negative",
      set: "Extended",
      explanation:
        "Stand with soft 19 versus 6 at a negative running count; otherwise double if legal, else stand.",
    },
    {
      id: "h17-hard13-2",
      hand: 13,
      dealer: 2,
      index: -1,
      above: "hit",
      below: "stand",
      trigger: "lte",
      set: "Extended",
      explanation: "Hit hard 13 versus 2 at TC −1 or below; otherwise stand.",
    },
    {
      id: "h17-hard12-4",
      hand: 12,
      dealer: 4,
      index: 0,
      above: "hit",
      below: "stand",
      trigger: "rc-negative",
      set: "Extended",
      explanation:
        "Hit hard 12 versus 4 at a negative running count; otherwise stand.",
    },
    {
      id: "h17-sur16-8",
      hand: 16,
      dealer: 8,
      index: 4,
      above: "surrender",
      below: "hit",
      set: "F4",
      explanation:
        "Surrender hard 16 versus 8 at TC +4 or higher when legal; otherwise hit.",
    },
    {
      id: "h17-sur16-9",
      hand: 16,
      dealer: 9,
      index: -1,
      above: "hit",
      below: "surrender",
      trigger: "lte",
      set: "F4",
      explanation:
        "With late surrender, hit hard 16 versus 9 at TC −1 or below; otherwise surrender.",
    },
    {
      id: "h17-sur15-9",
      hand: 15,
      dealer: 9,
      index: 2,
      above: "surrender",
      below: "hit",
      set: "F4",
      explanation:
        "Surrender hard 15 versus 9 at TC +2 or higher when legal; otherwise hit.",
    },
    {
      id: "h17-sur15-10",
      hand: 15,
      dealer: 10,
      index: 0,
      above: "hit",
      below: "surrender",
      trigger: "rc-negative",
      set: "F4",
      explanation:
        "With late surrender, hit hard 15 versus 10 at a negative running count; otherwise surrender.",
    },
    {
      id: "h17-sur15-A",
      hand: 15,
      dealer: 11,
      index: -1,
      above: "surrender",
      below: "hit",
      set: "F4",
      explanation:
        "Surrender hard 15 versus Ace at TC −1 or higher when legal; otherwise hit.",
    },
  ],
};
export const builtInIndexProfiles: IndexProfile[] = [conventional, h17];
export function indexPolicyKey(p: IndexProfile | undefined) {
  return p
    ? `${p.id}|${JSON.stringify({ rules: p.rules, precision: p.precision, rounding: p.rounding, entries: p.entries })}`
    : "";
}
export function describeProfile(p: IndexProfile) {
  const r = p.rules;
  return [
    r.decks ? `${r.decks} decks` : "Any deck count",
    r.hitSoft17 === undefined
      ? "Either soft-17 rule"
      : r.hitSoft17
        ? "H17"
        : "S17",
    r.holeCard === "peek" ? "US peek" : (r.holeCard ?? "Any hole-card rule"),
    r.das === undefined ? "Either DAS rule" : r.das ? "DAS" : "No DAS",
    r.double
      ? `Double ${r.double === "any" ? "any two" : r.double}`
      : "Any double restriction",
    r.maxHands ? `Up to ${r.maxHands} hands` : "Any split limit",
    r.hitSplitAces === false ? "No hitting split Aces" : "",
    r.resplitAces === false ? "No resplitting Aces" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export function indexProfileMatches(p: IndexProfile, r: Rules) {
  return (
    Object.entries(p.rules).every(([k, v]) => r[k as keyof Rules] === v) &&
    (r.countPrecision ?? 0.5) === p.precision &&
    (r.countRounding ?? "floor") === p.rounding
  );
}
export function selectProfile(
  r: Rules,
  id = "auto",
  custom: IndexProfile[] = [],
) {
  const profiles = [...builtInIndexProfiles, ...custom];
  return id === "auto"
    ? builtInIndexProfiles.find((p) => p.validated && indexProfileMatches(p, r))
    : profiles.find((p) => p.id === id && indexProfileMatches(p, r));
}
export function indexTriggered(entry: IndexRule, tc: number, rc: number) {
  return entry.trigger === "rc-positive"
    ? rc > 0
    : entry.trigger === "rc-negative"
      ? rc < 0
      : entry.trigger === "lte"
        ? tc <= entry.index
        : tc >= entry.index;
}
export function indexDecision(
  entry: IndexRule,
  tc: number,
  rc: number,
): IndexAction {
  return indexTriggered(entry, tc, rc) ? entry.above : entry.below;
}
export function applicableIndex(
  g: Game,
  p: IndexProfile,
  _tc = trueCount(g.running, g.shoe.length - g.cursor, p.precision, p.rounding)
    .index,
): IndexRule | undefined {
  const h = g.hands[g.active];
  if (!h || !indexProfileMatches(p, g.rules)) return;
  const v = evaluate(h.cards, h.split),
    d = value(g.dealer[0]);
  return [...p.entries]
    .sort(
      (a, b) =>
        Number(b.above === "surrender" || b.below === "surrender") -
        Number(a.above === "surrender" || a.below === "surrender"),
    )
    .find(
      (x) =>
        x.hand === v.total &&
        x.dealer === d &&
        !!x.soft === v.soft &&
        (!x.pair ||
          (h.cards.length === 2 && value(h.cards[0]) === value(h.cards[1]))) &&
        (!(x.above === "surrender" || x.below === "surrender") ||
          (!h.split &&
            h.cards.length === 2 &&
            g.rules.surrender &&
            legalActions(g).includes("surrender"))),
    );
}
export function validateIndexProfile(p: IndexProfile) {
  if (
    !p ||
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    typeof p.source !== "string" ||
    !p.rules ||
    typeof p.rules !== "object" ||
    Array.isArray(p.rules) ||
    !Array.isArray(p.entries)
  )
    throw Error("Invalid profile metadata");
  for (const [key, v] of Object.entries(p.rules))
    if (
      !(key in defaultRules) ||
      typeof v !== typeof defaultRules[key as keyof Rules]
    )
      throw Error("Invalid profile rule applicability");
  validateRules({
    ...defaultRules,
    ...p.rules,
    countPrecision: p.precision as Rules["countPrecision"],
    countRounding: p.rounding,
  });
  if (
    !p.name.trim() ||
    p.entries.length < 1 ||
    p.entries.length > 200 ||
    ![0.25, 0.5, 1].includes(p.precision) ||
    !["floor", "truncate", "round"].includes(p.rounding)
  )
    throw Error("Invalid index profile");
  const ids = new Set<string>();
  for (const x of p.entries) {
    if (
      typeof x.id !== "string" ||
      typeof x.explanation !== "string" ||
      !["I18", "F4", "Extended"].includes(x.set) ||
      (x.trigger !== undefined &&
        !["gte", "lte", "rc-positive", "rc-negative"].includes(x.trigger)) ||
      (x.soft !== undefined && typeof x.soft !== "boolean") ||
      (x.pair !== undefined && typeof x.pair !== "boolean")
    )
      throw Error("Invalid index condition metadata");
    if (
      (x.above === "insurance" ||
        x.below === "insurance" ||
        x.above === "decline" ||
        x.below === "decline") &&
      (x.hand !== 0 || x.dealer !== 11)
    )
      throw Error(
        "Insurance entries require an Ace upcard and hand condition zero.",
      );
    if (
      ids.has(x.id) ||
      !Number.isFinite(x.index) ||
      !Number.isInteger(x.index) ||
      !Number.isInteger(x.hand) ||
      !Number.isInteger(x.dealer) ||
      x.hand < 0 ||
      x.hand > 21 ||
      x.dealer < 2 ||
      x.dealer > 11 ||
      ![
        "hit",
        "stand",
        "double",
        "split",
        "surrender",
        "insurance",
        "decline",
      ].includes(x.above) ||
      ![
        "hit",
        "stand",
        "double",
        "split",
        "surrender",
        "insurance",
        "decline",
      ].includes(x.below)
    )
      throw Error("Invalid or duplicate index entry");
    ids.add(x.id);
  }
  return true;
}
