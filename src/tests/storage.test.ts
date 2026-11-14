// @vitest-environment jsdom
import { Rank, seededRandom } from "@/engine/cards";
import { act, deal, Game, newGame } from "@/engine/game";
import { reconstructCounts, replayFrames } from "@/engine/replay";
import { defaultRules } from "@/engine/rules";
import { RoundRecord } from "@/lib/analytics";
import { makeBackup, validateBackup, validateGame } from "@/lib/backup";
import {
  archiveRound,
  durableStorage,
  flushStorage,
  loadRound,
  retryStorage,
  storageHealth,
} from "@/lib/storage";
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
function rig(prefix: Rank[]) {
  const g = newGame(defaultRules, 100000, seededRandom(4), true);
  const rest = [...g.shoe];
  g.shoe = [
    ...prefix.map(
      (rank) =>
        rest.splice(
          rest.findIndex((c) => c.rank === rank),
          1,
        )[0],
    ),
    ...rest,
  ];
  return deal(g, 10);
}
it("split/double round has reconstructable event counts and visual checkpoints", () => {
  let g = rig(["5", "6", "5", "10", "6", "6", "10", "10", "10"]);
  g = act(g, "split");
  g = act(g, "double");
  g = act(g, "double");
  const events = g.events!;
  expect(events.some((e) => e.kind === "split-start")).toBe(true);
  expect(events.some((e) => e.kind === "choose-double")).toBe(true);
  expect(events.some((e) => e.kind === "settlement")).toBe(true);
  expect(reconstructCounts(events).every((e) => e.valid)).toBe(true);
  expect(replayFrames(events).at(-1)!.frame!.hands).toEqual(g.hands);
  expect(validateGame(g)).toEqual(g);
});
it("hidden dealer card contributes only on reveal during historical reconstruction", () => {
  let g = rig(["2", "7", "4", "K"]);
  const before = g.running;
  g = act(g, "stand");
  const events = g.events!;
  expect(events.find((e) => e.kind === "draw" && !e.visible)!.running).toBe(
    before,
  );
  expect(events.find((e) => e.kind === "reveal")!.running).toBe(before - 1);
  expect(reconstructCounts(events).every((e) => e.valid)).toBe(true);
});
it("IndexedDB archive roundtrips complete events and summary without changing live state", async () => {
  const g = act(rig(["10", "10", "8", "7"]), "stand");
  const record: RoundRecord = {
    id: "archive-test",
    session: "test",
    round: g.round,
    date: new Date().toISOString(),
    bankroll: g.bankroll,
    profit: g.bankroll - g.roundStart,
    wager: g.wagerCount,
    tc: g.tcAtBet,
    results: g.hands.map((h) => h.result!),
    decisions: g.decisions,
    rules: g.rules,
    duration: 1,
  };
  const payload = { id: record.id, session: "test", record, events: g.events! };
  await archiveRound(payload);
  await flushStorage();
  expect(await loadRound(record.id)).toEqual(payload);
});
it("storage writes stay usable when the localStorage mirror throws quota errors", async () => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = () => {
    throw new DOMException("Full", "QuotaExceededError");
  };
  await durableStorage.setItem(
    "quota-test",
    JSON.stringify({ state: { answer: 42 }, version: 0 }),
  );
  Storage.prototype.setItem = original;
  expect(
    JSON.parse((await durableStorage.getItem("quota-test"))!).state.answer,
  ).toBe(42);
  expect(storageHealth().mirror).toBe("full");
  expect(await retryStorage()).toBe(true);
});
it("backup validation rejects duplicate cards, count tampering and inconsistent balances", () => {
  const g = rig(["10", "10", "8", "7"]);
  expect(validateGame(g)).toEqual(g);
  for (const mutate of [
    (x: Game) => {
      x.shoe[0] = x.shoe[1];
    },
    (x: Game) => {
      x.running++;
    },
    (x: Game) => {
      x.bankroll++;
    },
  ]) {
    const x = structuredClone(g);
    mutate(x);
    expect(() => validateGame(x)).toThrow("Invalid backup");
  }
});
it("backup is fully validated before it can be restored", async () => {
  const g = rig(["10", "10", "8", "7"]);
  const data = await makeBackup(
    { game: g, history: [], indexProfiles: [] },
    { ramps: [] },
  );
  expect(validateBackup(data).game.game).toEqual(g);
  const bad = structuredClone(data);
  (bad.game.game as Game).cursor = 99999;
  expect(() => validateBackup(bad)).toThrow();
});
