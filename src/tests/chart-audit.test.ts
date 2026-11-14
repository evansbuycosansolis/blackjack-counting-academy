import { Hand } from "@/engine/game";
import { Rank, Card } from "@/engine/cards";
import { defaultRules } from "@/engine/rules";
import { referenceValues } from "@/engine/reference-strategy";
import { basicAction } from "@/engine/strategy";
import { it, expect } from "vitest";
it("published initial EV fixtures flag gross chart transcription mistakes across supported profiles", () => {
  const gaps: { slug: string; key: string; action: string; gap: number }[] = [];
  for (const [slug, ref] of Object.entries(referenceValues)) {
    const rules = {
      ...defaultRules,
      decks: Number(slug.match(/(\d)d/)![1]) as 1 | 2 | 4 | 6 | 8,
      hitSoft17: slug.includes("h17"),
      holeCard: (slug.startsWith("euro") ? "european" : "peek") as
        "peek" | "european",
      surrender: false,
    };
    for (const [key, ev] of Object.entries(ref.values)) {
      const [up, rs] = key.split(":"),
        ranks = rs.split(",").map((v) => (v === "11" ? "A" : v)) as Rank[];
      if (ranks.includes("A") && ranks.includes("10")) continue;
      const hand: Hand = {
          cards: ranks.map(
            (rank, i) => ({ id: String(i), rank, suit: "♠" }) as Card,
          ),
          bet: 1000,
          original: 1000,
          split: false,
          splitAces: false,
          done: false,
          surrendered: false,
          doubled: false,
        },
        a = basicAction(
          hand,
          { id: "up", rank: up === "11" ? "A" : (up as Rank), suit: "♣" },
          rules,
          ["hit", "stand", "double", "split"],
        );
      if (!a) continue;
      const i = { stand: 0, hit: 1, double: 2, split: 4, surrender: 0 }[a];
      const candidate = ev[i];
      if (candidate === null || candidate === undefined) continue;
      const best = Math.max(...ev.filter((x): x is number => x !== null));
      if (best - candidate > 0.07)
        gaps.push({ slug, key, action: a, gap: best - candidate });
    }
  }
  expect(gaps).toEqual([]);
});
