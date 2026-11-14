import { createShoe, Rank, seededRandom } from "@/engine/cards";
import { act, deal, newGame } from "@/engine/game";
import { defaultRules } from "@/engine/rules";
import { useGame } from "@/stores/game-store";
import { expect, it } from "vitest";
function shoeWith(prefix: Rank[]) {
  const shoe = createShoe(6, seededRandom(1));
  return [
    ...prefix.map(
      (rank) =>
        shoe.splice(
          shoe.findIndex((c) => c.rank === rank),
          1,
        )[0],
    ),
    ...shoe,
  ];
}
it("European second dealer card is observed exactly once", () => {
  let g = newGame({ ...defaultRules, holeCard: "european" });
  g.shoe = shoeWith(["10", "7", "8", "10"]);
  g = deal(g, 10);
  g = act(g, "stand");
  expect(g.cursor).toBe(4);
  expect(g.seen).toBe(4);
  expect(g.running).toBe(-2);
});
it("a natural immediately after a settled round is saved", () => {
  useGame.setState({ game: null, history: [], paused: false });
  useGame.getState().init();
  const g = useGame.getState().game!;
  useGame.setState({
    game: { ...g, shoe: shoeWith(["10", "10", "8", "7", "A", "9", "K", "8"]) },
  });
  useGame.getState().deal(10);
  useGame.getState().action("stand");
  useGame.getState().deal(10);
  expect(useGame.getState().history).toHaveLength(2);
  expect(useGame.getState().history[1].results).toEqual(["Blackjack"]);
});
it("configurable index conventions are used at wager placement", () => {
  let g = newGame({ ...defaultRules, countRounding: "truncate" });
  g.running = -2;
  g.cursor = 156;
  g = deal(g, 10);
  expect(g.tcAtBet).toBe(-0);
});
