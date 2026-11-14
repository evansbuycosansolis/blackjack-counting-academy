// @vitest-environment jsdom

import { Button } from "@/components/ui/button";
import { createShoe, seededRandom } from "@/engine/cards";
import { defaultRules } from "@/engine/rules";
import { useGame } from "@/stores/game-store";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
afterEach(cleanup);
describe("controls and store integration", () => {
  it("disabled controls cannot execute actions", () => {
    let count = 0;
    render(
      <Button disabled onClick={() => count++}>
        Double down
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(count).toBe(0);
  });
  it("shadcn Slot preserves link semantics", () => {
    render(
      <Button asChild>
        <a href="#academy">Learn</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute(
      "href",
      "#academy",
    );
  });
  it("settlement creates one persistent record and replayable decision", () => {
    useGame.getState().configure(defaultRules, 1000);
    let g = useGame.getState().game!;
    const shoe = createShoe(6, seededRandom(22)),
      ranks = ["10", "10", "8", "7"];
    const prefix = ranks.map(
      (rank) =>
        shoe.splice(
          shoe.findIndex((c) => c.rank === rank),
          1,
        )[0],
    );
    g = { ...g, shoe: [...prefix, ...shoe] };
    useGame.setState({ game: g, history: [] });
    useGame.getState().deal(10);
    useGame.getState().action("stand");
    expect(useGame.getState().history).toHaveLength(1);
    expect(useGame.getState().history[0].decisions).toHaveLength(1);
    expect(useGame.getState().game!.bankroll).toBe(101000);
    useGame.getState().action("stand");
    expect(useGame.getState().history).toHaveLength(1);
    expect(
      JSON.parse(localStorage.getItem("blackjack-academy-v1")!).state.history,
    ).toHaveLength(1);
  });
  it("pause prevents mutations and rules cannot change during a round", () => {
    useGame.getState().configure(defaultRules, 1000);
    useGame.setState({ paused: true });
    const before = useGame.getState().game;
    useGame.getState().deal(10);
    expect(useGame.getState().game).toBe(before);
    useGame.setState({ paused: false });
    useGame.getState().deal(10);
    if (
      useGame.getState().game?.phase === "playing" ||
      useGame.getState().game?.phase === "insurance"
    ) {
      const active = useGame.getState().game;
      useGame.getState().configure({ ...defaultRules, decks: 8 }, 2000);
      expect(useGame.getState().game).toBe(active);
    }
  });
});
