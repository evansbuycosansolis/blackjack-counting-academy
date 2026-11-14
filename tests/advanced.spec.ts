import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newGame } from "../src/engine/game";
import { defaultRules } from "../src/engine/rules";
import { seededRandom, Rank } from "../src/engine/cards";
function fixture(prefix: Rank[]) {
  const g = newGame(defaultRules, 100000, seededRandom(7), true),
    rest = [...g.shoe];
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
  return g;
}
test("split/double replay, IndexedDB reload and validated backup restoration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const game = fixture(["5", "6", "5", "10", "6", "6", "10", "10", "10"]);
  await page.addInitScript(
    ({ game }) => {
      if (!localStorage.getItem("fixture-created")) {
        localStorage.setItem(
          "blackjack-academy-v1",
          JSON.stringify({
            state: {
              game,
              rules: game.rules,
              history: [],
              session: "replay-e2e",
              started: Date.now(),
            },
            version: 0,
          }),
        );
        localStorage.setItem("fixture-created", "1");
      }
    },
    { game },
  );
  await page.goto("/");
  await expect(page.locator(".error")).toHaveCount(0);
  await page.getByRole("button", { name: /Deal hand/ }).click();
  await page.getByRole("button", { name: /^split / }).click();
  await page.getByRole("button", { name: /Double down/ }).click();
  await page.getByRole("button", { name: /Double down/ }).click();
  await expect(page.getByRole("button", { name: /Deal hand/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Statistics & analytics", exact: true })
    .click();
  await page.getByRole("button", { name: /Round 1/ }).click();
  await expect(
    page.getByRole("heading", { name: /Visual round replay/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/all recorded visible-card tags reconcile/),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Replay event" }).focus();
  await page.getByRole("slider", { name: "Replay event" }).press("End");
  await expect(page.locator(".replay-felt")).toContainText("DOUBLED");
  await page
    .getByRole("button", { name: "Table settings", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export complete backup", exact: true })
    .click();
  const file = await download,
    payload = await readFile((await file.path())!);
  const data = JSON.parse(payload.toString());
  expect(data.rounds).toHaveLength(1);
  expect(
    data.rounds[0].events.some(
      (e: { kind: string }) => e.kind === "split-start",
    ),
  ).toBe(true);
  await page.getByLabel("Choose backup JSON").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: payload,
  });
  await expect(
    page.getByRole("button", { name: "Restore validated backup" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore validated backup" }).click();
  await expect(
    page.getByText(/Backup restored. The table is paused/),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Play blackjack", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Session paused" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("named ramps, custom index exercises and independent-session studies persist", async ({
  page,
}) => {
  await page.goto("/#betting");
  await page
    .getByRole("textbox", { name: "Ramp name", exact: true })
    .fill("Test spread");
  await page
    .getByRole("button", { name: "Duplicate ramp", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Named betting ramp" }),
  ).toContainText("Test spread");
  await page
    .getByRole("spinbutton", { name: "Independent sessions", exact: true })
    .fill("12");
  await page
    .getByRole("spinbutton", { name: "Session horizon", exact: true })
    .fill("20");
  await page
    .getByRole("button", { name: "Run independent sessions", exact: true })
    .click();
  await expect(
    page.getByText("Completed independent-session study", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.reload();
  await expect(
    page.getByText("Completed independent-session study", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Strategy deviations", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Exercise", exact: true })
    .selectOption("Insurance");
  await page.getByRole("button", { name: "decline", exact: true }).click();
  await expect(
    page.getByText(
      /Correct. Decline|Correct. insurance|Correct. Insurance|Correct.*/,
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate & edit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save custom profile", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Study profile" }),
  ).toContainText("custom / unvalidated");
});
test("timed sprint stops, records active pace and exposes mastery progress", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/#counting");
  await page
    .getByRole("combobox", { name: "Training mode", exact: true })
    .selectOption("Timed sprint");
  await page
    .getByRole("combobox", { name: "Sprint duration", exact: true })
    .selectOption("30");
  await page.getByRole("button", { name: "Auto deal", exact: true }).click();
  await page.clock.runFor(31000);
  await expect(
    page.getByRole("button", { name: "Auto deal", exact: true }),
  ).toBeDisabled();
  await page.getByPlaceholder("Your count").fill("0");
  await page.getByRole("button", { name: "Check count", exact: true }).click();
  await page
    .getByRole("button", { name: "Learning academy", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Timed drill records", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Your next training milestone/ }),
  ).toBeVisible();
});
test("composition action analysis works in a worker without exposing casino-mode aids", async ({
  page,
}) => {
  const game = fixture(["10", "6", "8", "10"]);
  await page.addInitScript(
    ({ game }) =>
      localStorage.setItem(
        "blackjack-academy-v1",
        JSON.stringify({
          state: {
            game,
            rules: game.rules,
            history: [],
            session: "analysis-e2e",
            started: Date.now(),
          },
          version: 0,
        }),
      ),
    { game },
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Deal hand/ }).click();
  await page
    .getByRole("button", { name: "Analyze action EV", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Analysis trials" })
    .selectOption("2000");
  await page.getByRole("button", { name: "Calculate action values" }).click();
  await expect(
    page.getByRole("table").filter({ hasText: "Net EV / initial round wager" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByText(
      /Exact finite-composition result|Monte Carlo policy evaluation/,
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close analysis" }).click();
  await page.getByRole("button", { name: "Casino view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Analyze action EV", exact: true }),
  ).toHaveCount(0);
});
