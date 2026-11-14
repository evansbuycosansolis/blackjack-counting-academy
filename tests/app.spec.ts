import { expect, test } from "@playwright/test";
test("play, settle, persist and review actual rounds", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every hand is a lesson." }),
  ).toBeVisible();
  for (let n = 0; n < 3; n++) {
    await page.getByRole("button", { name: /Deal hand/ }).click();
    const decline = page.getByRole("button", { name: "Decline insurance" });
    if (await decline.isVisible()) await decline.click();
    const stand = page.getByRole("button", { name: /^stand/ });
    if (await stand.isVisible()) {
      await stand.click();
    }
    await expect(page.getByRole("button", { name: /Deal hand/ })).toBeVisible();
  }
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("blackjack-academy-v1")!).state,
  );
  expect(before.history).toHaveLength(3);
  expect(before.game.phase).toBe("settled");
  expect(before.game.seen).toBe(before.game.cursor);
  await page.reload();
  await expect(page.getByRole("button", { name: /Deal hand/ })).toBeVisible();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("blackjack-academy-v1")!).state,
  );
  expect(after.game.bankroll).toBe(before.game.bankroll);
  expect(after.game.cursor).toBe(before.game.cursor);
  await page
    .getByRole("button", { name: "Statistics & analytics", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your progress, in perspective." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Round 3/ }).click();
  await expect(page.getByText(/Session elapsed/)).toBeVisible();
  expect(errors).toEqual([]);
});
test("counting drill, checkpoint score and academy quiz persist", async ({
  page,
}) => {
  await page.goto("/#counting");
  await expect(
    page.getByRole("heading", { name: "Keep the count. Find your rhythm." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next card" }).click();
  const title = await page
    .getByRole("heading", { name: /Running count:/ })
    .innerText();
  await page.getByPlaceholder("Your count").fill(title.split(":")[1].trim());
  await page.getByRole("button", { name: "Check count", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Correct!");
  await page
    .getByRole("button", { name: "Learning academy", exact: true })
    .click();
  await page.getByRole("button", { name: /^B\s*21/ }).click();
  await expect(page.getByRole("status")).toContainText("Correct.");
  await page.reload();
  await expect(
    page.getByText("1 / 7 levels completed", { exact: true }),
  ).toBeVisible();
});
test("worker completes seeded simulation and supports cancellation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#betting");
  await page
    .getByRole("combobox", { name: "Rounds", exact: true })
    .selectOption("1000");
  await page
    .getByRole("spinbutton", { name: "Initial virtual bankroll", exact: true })
    .fill("100000");
  await page
    .getByRole("button", { name: "Run simulation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Simulation results", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Completed · 1,000 rounds/)).toBeVisible();
  await page
    .getByRole("combobox", { name: "Rounds", exact: true })
    .selectOption("1000000");
  await page
    .getByRole("button", { name: "Run simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(/Cancelled ·/)).toBeVisible({ timeout: 30000 });
  expect(errors).toEqual([]);
});
test("responsive navigation and every main section render without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every hand is a lesson." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const name of [
    "Counting trainer",
    "Basic strategy",
    "Betting laboratory",
    "Strategy deviations",
    "Statistics & analytics",
    "Learning academy",
    "Table settings",
    "Play blackjack",
  ]) {
    await page
      .getByRole("button", { name: "Toggle navigation", exact: true })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("desktop screenshot and pause prevent actions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await page.getByRole("button", { name: /Deal hand/ }).click();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Pause session", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Session paused" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resume practice", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Session paused" }),
  ).not.toBeVisible();
});

test("one million rounds finish in a worker while controls remain responsive", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/#betting");
  await page
    .getByRole("combobox", { name: "Rounds", exact: true })
    .selectOption("1000000");
  await page
    .getByRole("spinbutton", { name: "Initial virtual bankroll", exact: true })
    .fill("10000000");
  await page
    .getByRole("button", { name: "Run simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator(".app")).toHaveClass(/light/);
  await expect(page.getByText(/Completed · 1,000,000 rounds/)).toBeVisible({
    timeout: 110000,
  });
});
