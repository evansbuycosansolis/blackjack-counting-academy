import { createShoe, seededRandom, trueCount, type Rank } from "@/engine/cards";
import { deal, insurance, newGame } from "@/engine/game";
import {
  builtInIndexProfiles,
  indexDecision,
  indexProfileMatches,
  indexTriggered,
  validateIndexProfile,
} from "@/engine/index-profiles";
import { defaultRules } from "@/engine/rules";
import { adjusted } from "@/engine/strategy";
import { expect, it } from "vitest";
it("built-in profiles have valid entries, references and exact applicability", () => {
  for (const p of builtInIndexProfiles) {
    expect(validateIndexProfile(p)).toBe(true);
    expect(p.source.startsWith("https://")).toBe(true);
    expect(
      indexProfileMatches(p, {
        ...defaultRules,
        ...p.rules,
        countRounding: p.rounding,
        countPrecision: p.precision as 0.5,
      }),
    ).toBe(true);
    expect(
      indexProfileMatches(p, {
        ...defaultRules,
        ...p.rules,
        countRounding: p.rounding === "truncate" ? "floor" : "truncate",
      }),
    ).toBe(false);
  }
});
it("threshold exercise tests below, at and above every conventional index", () => {
  for (const p of builtInIndexProfiles)
    for (const x of p.entries) {
      if (x.trigger === "rc-positive") {
        expect(indexTriggered(x, 0, 0)).toBe(false);
        expect(indexTriggered(x, 0, 1)).toBe(true);
      } else if (x.trigger === "rc-negative") {
        expect(indexTriggered(x, 0, 0)).toBe(false);
        expect(indexTriggered(x, 0, -1)).toBe(true);
      } else if (x.trigger === "lte") {
        expect(indexDecision(x, x.index - 1, 0)).toBe(x.above);
        expect(indexDecision(x, x.index, 0)).toBe(x.above);
        expect(indexDecision(x, x.index + 1, 0)).toBe(x.below);
      } else {
        expect(indexDecision(x, x.index - 1, -9)).toBe(x.below);
        expect(indexDecision(x, x.index, 0)).toBe(x.above);
        expect(indexDecision(x, x.index + 1, 9)).toBe(x.above);
      }
    }
});
it("H17 BJA hard 16 versus 9 stands at its published +4 index", () => {
  let g = newGame(
    {
      ...defaultRules,
      hitSoft17: true,
      surrender: false,
      countRounding: "truncate",
    },
    100000,
    seededRandom(1),
  );
  const rest = createShoe(6, seededRandom(2)),
    prefix = ["10", "9", "6", "8"].map(
      (rank) =>
        rest.splice(
          rest.findIndex((c) => c.rank === rank),
          1,
        )[0],
    );
  g.shoe = [...prefix, ...rest];
  g = deal(g, 10);
  expect(adjusted(g, 3)).toBe("hit");
  expect(adjusted(g, 4)).toBe("stand");
});
it("editing a profile cannot create malformed entries", () => {
  const p = structuredClone(builtInIndexProfiles[0]);
  p.entries[0].index = NaN;
  expect(() => validateIndexProfile(p)).toThrow();
});
it("H17 negative thresholds and surrender precedence follow the published conditions", () => {
  const fixture = (player: Rank[], up: Rank) => {
    let g = newGame(
      { ...defaultRules, hitSoft17: true, countRounding: "truncate" },
      100000,
      seededRandom(8),
    );
    const rest = [...g.shoe];
    const prefix = [player[0], up, player[1], "2"].map(
      (r) =>
        rest.splice(
          rest.findIndex((c) => c.rank === r),
          1,
        )[0],
    );
    g.shoe = [...prefix, ...rest];
    g = deal(g, 10);
    if (g.phase === "insurance") g = insurance(g, false);
    return g;
  };
  const g = fixture(["10", "6"], "9");
  expect(adjusted(g, -1)).toBe("hit");
  expect(adjusted(g, 0)).toBe("surrender");
  const hard13 = fixture(["10", "3"], "2");
  expect(adjusted(hard13, -1)).toBe("hit");
  expect(adjusted(hard13, 0)).toBe("stand");
  const soft19 = fixture(["A", "8"], "6");
  soft19.running = -1;
  expect(adjusted(soft19, 0)).toBe("stand");
  soft19.running = 0;
  expect(adjusted(soft19, 0)).toBe("double");
  const hard15 = fixture(["10", "5"], "10");
  hard15.running = -1;
  expect(adjusted(hard15, 0)).toBe("hit");
  hard15.running = 0;
  expect(adjusted(hard15, 0)).toBe("surrender");
  expect(trueCount(-1, 260, 0.5, "truncate").index === 0).toBe(true);
  expect(trueCount(-5, 260, 0.5, "truncate").index).toBe(-1);
});
