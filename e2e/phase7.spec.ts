import { setTime } from "./helpers";
import { test, expect, type Locator } from "@playwright/test";
import { pointerReorder, analyzeSample, configuration, details, english, saved } from "./helpers";

async function recommendedGoals(row: Locator) {
  await expect(row.getByRole("button", { name: "Remove goal 1", exact: true })).toHaveCount(0);
  await expect(row.locator("[data-item-number]").nth(1)).toHaveText("a.");
  await row.getByRole("button", { name: "Add Goal", exact: true }).click();
  await row.getByRole("textbox", { name: "Goal 2", exact: true }).fill("Second goal");
  await row.getByRole("button", { name: "Add Goal", exact: true }).click();
  await row.getByRole("textbox", { name: "Goal 3", exact: true }).fill("Third goal");
  await expect(row.locator("[data-item-number]").nth(3)).toHaveText("c.");
  await row.getByRole("button", { name: "Remove goal 2", exact: true }).click();
  await expect(row.getByRole("textbox", { name: "Goal 2", exact: true })).toHaveValue("Third goal");
  await expect(row.locator("[data-item-number]").nth(2)).toHaveText("b.");
}

test("time errors are immediate, preserve input, and retain participants", async ({ page }) => {
  await english(page);
  await details(page);
  await expect(page.getByText(/Same-day meeting|5-minute increments|Maximum 12 hours/)).toHaveCount(
    0,
  );
  await setTime(page, "Start time", "20:20");
  await setTime(page, "End time", "19:20");
  await expect(page.getByRole("alert")).toHaveText("End time must be later than start time");
  for (const field of ["Start time", "End time"])
    await expect(
      page.getByRole("group", { name: field, exact: true }).getByRole("combobox").first(),
    ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("group", { name: "End time", exact: true }).getByRole("combobox").first(),
  ).toHaveValue("19");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await setTime(page, "End time", "20:50");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await page
    .getByRole("button", {
      name: "Edit participant: zhaojiaheng@superintelligence.com",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Display name", { exact: true })).toBeEditable();
});

test("creation and editing share a visible goal document without a hidden rules form", async ({
  page,
}) => {
  await english(page);
  await configuration(page);
  const checkRules = async (root: Locator) => {
    await expect(root.getByRole("heading", { name: "Meeting Rules", exact: true })).toHaveCount(0);
    const goal = root.getByLabel("Meeting Goals", { exact: true });
    await expect(goal).toBeEditable();
    await goal.fill("Assess release readiness\nTopic: Extra topic\nDecision: Confirm release");
  };
  await checkRules(page.getByRole("dialog"));
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await checkRules(page.getByRole("dialog"));
  await recommendedGoals(page.locator('[data-sortable^="segments/"]').first());
  await page.getByRole("button", { name: "Save requirements", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Not analyzed");
});

for (const [template, group] of [
  ["Product Launch Decision", "segments"],
  ["Project Retrospective", "stages"],
  ["Customer Progress Meeting", "stages"],
] as const) {
  test(`${template}: numbered drag ordering and protected lettered goals`, async ({ page }) => {
    await english(page);
    await configuration(page, template);
    const rows = page.locator(`[data-sortable^="${group}/"]`);
    const firstName = await rows.first().getByRole("textbox").first().inputValue();
    await rows.nth(1).evaluate((el) => el.scrollIntoView({ block: "center" }));
    await pointerReorder(page, rows.first(), rows.nth(1));
    await expect(rows.nth(1).getByRole("textbox").first()).toHaveValue(firstName);
    await expect(rows.first().locator("[data-item-number]").first()).toHaveText("1.");
    await expect(rows.nth(1).locator("[data-item-number]").first()).toHaveText("2.");
    await recommendedGoals(rows.first());
  });
}

test("deleting timeline segments reallocates all minutes, including the final protected segment", async ({
  page,
}) => {
  await english(page);
  await configuration(page);
  await page.getByRole("button", { name: "Remove segment 3", exact: true }).click();
  await expect(page.locator('[data-sortable^="segments/"]')).toHaveCount(4);
  await expect(page.getByRole("textbox", { name: "Segment 3", exact: true })).toHaveValue(
    "Decision",
  );
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Remove segment 1", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Duration 1", exact: true })).toHaveValue("30");
  await expect(page.getByRole("button", { name: "Remove segment 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  expect((await saved(page))[0].structure.segments).toHaveLength(1);
  expect((await saved(page))[0].structure.segments[0].minutes).toBe(30);
});

test("sample meetings require AI clicks and show human-readable requirements in both languages", async ({
  page,
}) => {
  await page.goto("/meetings/demo-launch");
  await expect(page.getByRole("status")).toHaveText("未分析");
  await expect(page.getByRole("button", { name: "AI分析会议", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "导入文本", exact: true })).toBeVisible();
  await expect(page.getByText(/演示分析|重置演示|实时记录/)).toHaveCount(0);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Required Speakers", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Segment Goals", exact: true })).toBeVisible();
  const requirements = page.locator('section[aria-labelledby="requirements-heading"]');
  await expect(requirements.locator("section").first().locator("ol")).toHaveClass(/list-none/);
  await expect(requirements.locator("section").nth(2).locator("ol")).toHaveClass(/list-decimal/);
  await expect(page.getByRole("heading", { name: "AI Analysis", exact: true })).toHaveCount(0);
  await analyzeSample(page);
  const results = page.locator("#analysis-results");
  await expect(
    results.getByText("Meeting Goals · 评估收藏提醒功能能否在下周一上线。", { exact: true }),
  ).toBeVisible();
  await expect(
    results.getByText("Required conclusions · 产品与技术对发布准备情况达成共识", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(results.getByRole("heading", { name: "要求评估", exact: true })).toBeVisible();
  await expect(results.getByText(/l-goal|l-conclusion|structure-/)).toHaveCount(0);
  await expect(page.getByText(/Demo Analysis|Reset Demo|演示分析|重置演示/)).toHaveCount(0);
});
