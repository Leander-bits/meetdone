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

test("time errors are immediate, preserve input, and protect the first participant", async ({
  page,
}) => {
  await english(page);
  await details(page);
  await expect(page.getByText(/Same-day meeting|5-minute increments|Maximum 12 hours/)).toHaveCount(
    0,
  );
  await page.getByLabel("Start time", { exact: true }).fill("20:20");
  await page.getByLabel("End time", { exact: true }).fill("19:20");
  await expect(page.getByRole("alert")).toHaveText("End time must be later than start time");
  for (const field of ["Start time", "End time"])
    await expect(page.getByLabel(field, { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("End time", { exact: true })).toHaveValue("19:20");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await page.getByLabel("End time", { exact: true }).fill("20:50");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Add participant", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove participant 1", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Remove participant 2", exact: true }).click();
  await expect(page.getByLabel("Display name 1", { exact: true })).toBeEditable();
});

test("creation and editing share expanded ordered rules, numbering and deferral icon", async ({
  page,
}) => {
  await english(page);
  await configuration(page);
  const checkRules = async (root: Locator) => {
    const rules = root
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Meeting Rules", exact: true }) })
      .last();
    await expect(rules.locator("summary")).toHaveCount(0);
    await expect(rules.locator("legend")).toHaveText([
      "Topics",
      "Required conclusions",
      "Decisions",
      "Action outputs",
    ]);
    const topics = rules.locator("fieldset").first();
    await expect(topics.locator("[data-item-number]")).toHaveText(["1.", "2."]);
    await topics.getByRole("button", { name: "Add item", exact: true }).click();
    await topics.getByRole("textbox", { name: "Topics 3", exact: true }).fill("Extra topic");
    await topics.getByRole("button", { name: "Remove: Topics 2", exact: true }).click();
    await expect(topics.getByRole("textbox", { name: "Topics 2", exact: true })).toHaveValue(
      "Extra topic",
    );
    await expect(topics.locator("[data-item-number]")).toHaveText(["1.", "2."]);
    const toggle = topics
      .getByRole("button", {
        name: "Allow conversion into a follow-up action with owner and deadline",
        exact: true,
      })
      .first();
    const original = await toggle.getAttribute("aria-pressed");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", original === "true" ? "false" : "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", original!);
    await expect(toggle).toHaveAttribute(
      "title",
      "Allow conversion into a follow-up action with owner and deadline",
    );
    await expect(topics.getByRole("checkbox")).toHaveCount(0);
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
    results.getByText("Meeting Goals · Assess release readiness", { exact: true }),
  ).toBeVisible();
  await expect(
    results.getByText("Required conclusions · Agree on the launch readiness assessment", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(results.getByRole("heading", { name: "要求评估", exact: true })).toBeVisible();
  await expect(results.getByText(/l-goal|l-conclusion|structure-/)).toHaveCount(0);
  await expect(page.getByText(/Demo Analysis|Reset Demo|演示分析|重置演示/)).toHaveCount(0);
});
