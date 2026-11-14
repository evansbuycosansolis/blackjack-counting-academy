import { expect, test, type Page } from "@playwright/test";
import { newGame, deal } from "../src/engine/game";
import { defaultRules, type Rules } from "../src/engine/rules";
import { hilo, seededRandom, type Rank } from "../src/engine/cards";

async function load(
  page: Page,
  ranks: Rank[],
  overrides: Partial<Rules> = {},
  nearEnd = false,
  atCut = false,
) {
  const rules = { ...defaultRules, ...overrides };
  let game = newGame(rules, 100000, seededRandom(7), true);
  const rest = [...game.shoe];
  const prefix = ranks.map(
    (rank) =>
      rest.splice(
        rest.findIndex((c) => c.rank === rank),
        1,
      )[0],
  );
  if (nearEnd) {
    const past = rest.splice(0, 42);
    game.shoe = [...past, ...prefix, ...rest];
    game.cursor = past.length;
    game.discards = past;
    game.seen = past.length;
    game.running = past.reduce((n, c) => n + hilo(c), 0);
    game = deal(game, 10);
  } else game.shoe = [...prefix, ...rest];
  if (atCut) {
    game.cursor = Math.floor(game.shoe.length * rules.penetration);
    game.discards = game.shoe.slice(0, game.cursor);
    game.seen = game.cursor;
    game.running = game.discards.reduce((n, c) => n + hilo(c), 0);
  }
  await page.addInitScript(
    ({ game }) => {
      localStorage.setItem(
        "blackjack-academy-v1",
        JSON.stringify({
          state: {
            game,
            rules: game.rules,
            history: [],
            session: "acceptance",
            started: Date.now(),
          },
          version: 0,
        }),
      );
    },
    { game },
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every hand is a lesson." }),
  ).toBeVisible();
  await expect(page.locator(".error")).toHaveCount(0);
}

const scenarios: {
  name: string;
  ranks: Rank[];
  rules?: Partial<Rules>;
  actions: string[];
  bank: number;
  hands?: number;
}[] = [
  {
    name: "resplit non-Aces",
    ranks: ["8", "6", "8", "10", "8", "3", "2", "10", "10"],
    actions: ["split", "split", "stand", "stand", "stand"],
    bank: 103000,
    hands: 3,
  },
  {
    name: "resplit Aces without treating split 21 as a natural",
    ranks: ["A", "6", "A", "10", "A", "9", "10", "8", "10"],
    rules: { resplitAces: true },
    actions: ["split", "split"],
    bank: 103000,
    hands: 3,
  },
  {
    name: "restricted double after split",
    ranks: ["5", "6", "5", "10", "6", "6", "10", "10", "10"],
    rules: { double: "10-11", maxHands: 2 },
    actions: ["split", "double", "double"],
    bank: 104000,
    hands: 2,
  },
  {
    name: "late surrender",
    ranks: ["10", "10", "6", "7"],
    actions: ["surrender"],
    bank: 99500,
  },
  {
    name: "insurance offsets dealer blackjack",
    ranks: ["10", "A", "9", "K"],
    actions: ["Take insurance"],
    bank: 100000,
  },
  {
    name: "even money settles player blackjack",
    ranks: ["A", "A", "K", "K"],
    actions: ["Even money"],
    bank: 101000,
  },
  {
    name: "delayed blackjack refunds extra double in OBO",
    ranks: ["5", "A", "6", "10", "10"],
    rules: {
      holeCard: "no-peek",
      insurance: false,
      dealerBlackjackLoss: "original",
    },
    actions: ["double"],
    bank: 99000,
  },
];
for (const scenario of scenarios)
  test(`controlled settlement: ${scenario.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await load(page, scenario.ranks, scenario.rules);
    await page.getByRole("button", { name: /Deal hand/ }).click();
    for (const action of scenario.actions) {
      const pattern =
        action === "double"
          ? /Double down/
          : new RegExp(`^${action}(?: |$)`, "i");
      // Separate deliberate decisions from the table's 160ms duplicate-click guard.
      await page.getByRole("button", { name: pattern }).click({ delay: 180 });
    }
    await expect(page.getByRole("button", { name: /Deal hand/ })).toBeVisible();
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("blackjack-academy-v1")!).state,
    );
    expect(saved.game.bankroll).toBe(scenario.bank);
    if (scenario.hands) expect(saved.game.hands).toHaveLength(scenario.hands);
    expect(saved.history).toHaveLength(1);
    expect(errors).toEqual([]);
    if (scenario.name === "resplit non-Aces") {
      await page
        .getByRole("button", { name: "Learning academy", exact: true })
        .click();
      await expect(
        page.locator(".achievement.earned").filter({ hasText: "First hand" }),
      ).toBeVisible();
    }
    if (scenario.name === "restricted double after split")
      await page.screenshot({
        path: "test-results/desktop-split-double.png",
        fullPage: true,
      });
  });

test("exact composition coaching and same-policy hit/split EV curves work on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await load(
    page,
    ["8", "6", "8", "10"],
    { decks: 1, penetration: 0.9, maxHands: 2, double: "10-11" },
    true,
  );
  await page
    .getByRole("button", { name: "Solve current decision exactly" })
    .click();
  await expect(page.getByText(/Exact composition action:/)).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Analyze action EV", exact: true })
    .click();
  await page.getByLabel("Analysis trials").selectOption("2000");
  await page.getByRole("button", { name: "Calculate action values" }).click();
  await expect(
    page.getByText("Exact finite-composition result", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Compare exact EV with independent trials" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Simulation EV convergence curves" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("heading", { name: /split · exact EV/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /hit · exact EV/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-ev-comparison.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("cut-card reshuffle resets observable counts before the next round", async ({
  page,
}) => {
  await load(page, ["5", "6", "7", "8"], { insurance: false }, false, true);
  await page.getByRole("button", { name: /Deal hand/ }).click();
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem("blackjack-academy-v1")!).state.game,
  );
  expect(state.shuffles).toBe(2);
  expect(state.cursor).toBeLessThan(20);
  expect(state.seen).toBe(
    state.cursor - Number(!state.revealed && state.dealer.length === 2),
  );
});

test("H17 study convention and all negative/surrender rows are available", async ({
  page,
}) => {
  await page.goto("/#deviations");
  await page.getByLabel("Study profile").selectOption("bja-h17");
  await expect(page.getByText(/nearest 0.5 deck · truncate TC/)).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate & edit", exact: true })
    .click();
  await expect(page.getByLabel("Explanation row 27")).toBeVisible();
  await expect(page.getByLabel("Trigger row 21")).toHaveValue("lte");
});
