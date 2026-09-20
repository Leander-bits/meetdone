import { test, expect } from "@playwright/test";
import { configuration, details, english, saved } from "./helpers";

test("native speaker dragging and reset work alongside keyboard controls", async ({ page }) => {
  await english(page);
  await details(page);
  await page.getByRole("button", { name: "Add participant", exact: true }).click();
  await page.getByLabel("Email 2", { exact: true }).fill("max@example.com");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Product Launch Decision", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Speaker Sequence", exact: true }).click();
  const rows = page.locator('[data-sortable^="speakers/"]');
  await rows.nth(1).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await rows.first().locator('[draggable="true"]').dragTo(rows.nth(1));
  await expect(rows.first()).toContainText("max");
  await expect(rows.first().locator("[data-item-number]").first()).toHaveText("1.");
  await expect(rows.nth(1).locator("[data-item-number]").first()).toHaveText("2.");
  await page.getByRole("button", { name: "Reset order", exact: true }).click();
  await expect(rows.first()).toContainText("zhaojiaheng");
});

test("matrix chips can be dragged into stages, including on a mobile-sized layout", async ({
  page,
}, info) => {
  await english(page);
  await configuration(page, "Customer Progress Meeting");
  const chip = page.locator('button[draggable="true"]').first();
  await chip.dragTo(page.getByRole("textbox", { name: "Stage 1", exact: true }));
  await expect(page.getByRole("checkbox", { name: "Required Speaker", exact: true })).toHaveCount(
    1,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("textbox", { name: "Stage 1", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("matrix-mobile.png"), fullPage: true });
});

test("timeline resizing, adding and keyboard reordering preserve full duration", async ({
  page,
}, info) => {
  await english(page);
  await configuration(page);
  await page.getByRole("slider", { name: "Duration 1", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider", { name: "Duration 1", exact: true })).toHaveValue("10");
  await page.getByRole("button", { name: "Add segment", exact: true }).click();
  await page.getByRole("textbox", { name: "Segment 6", exact: true }).fill("Q&A");
  await page.getByRole("button", { name: "Move up 6", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Segment 5", exact: true })).toHaveValue("Q&A");
  await page.locator("[data-sortable]").first().getByText("Recommended goals").click();
  await expect(
    page
      .locator("[data-sortable]")
      .first()
      .getByRole("button", { name: "Remove goal 1", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("timeline.png"), fullPage: true });
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  const m = (await saved(page))[0];
  expect(m.structure.segments.reduce((n: number, s: { minutes: number }) => n + s.minutes, 0)).toBe(
    30,
  );
  expect(m.structure.segments).toHaveLength(6);
});
test("speaker roles, optionality and speaking order are stored", async ({ page }) => {
  await english(page);
  await configuration(page);
  await page.getByRole("button", { name: "Speaker Sequence", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Role: zhaojiaheng", exact: true })
    .selectOption("Engineering");
  await page.getByRole("checkbox", { name: "Required Speaker", exact: true }).uncheck();
  await expect(
    page.getByRole("checkbox", { name: "Optional Speaker", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  const m = (await saved(page))[0];
  expect(m.participants[0].role).toBe("Engineering");
  expect(m.structure.requiredSpeakerIds).toEqual([]);
  expect(
    m.requirements.items.find((r: { id: string }) => r.id.startsWith("speaker-all-")).level,
  ).toBe("record_only");
});
test("custom stages join the sequence immediately and survive reset", async ({ page }) => {
  await english(page);
  await configuration(page, "Project Retrospective");
  await page.getByRole("button", { name: "Add stage", exact: true }).click();
  await page.getByRole("textbox", { name: "Stage 6", exact: true }).fill("Team questions");
  await page.getByRole("button", { name: "Move up 6", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Stage 5", exact: true })).toHaveValue(
    "Team questions",
  );
  await page.getByRole("button", { name: "Reset stage order", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Stage 6", exact: true })).toHaveValue(
    "Team questions",
  );
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  expect((await saved(page))[0].structure.stages).toHaveLength(6);
});
test("matrix assigns one person to multiple stages with independent required flags", async ({
  page,
}, info) => {
  await english(page);
  await configuration(page, "Customer Progress Meeting");
  await expect(page.getByRole("button", { name: "Create Meeting", exact: true })).toBeDisabled();
  const personId = await page
    .getByRole("combobox", { name: "Assign participant: Background", exact: true })
    .locator("option")
    .nth(1)
    .getAttribute("value");
  for (const stage of ["Background", "Proposal", "Risks", "Decision", "Next Steps"])
    await page
      .getByRole("combobox", { name: `Assign participant: ${stage}`, exact: true })
      .selectOption(personId!);
  await page.getByRole("checkbox", { name: "Required Speaker", exact: true }).first().uncheck();
  await page.screenshot({ path: info.outputPath("matrix.png"), fullPage: true });
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  const m = (await saved(page))[0];
  expect(m.structure.stages[0].assignments[0].required).toBe(false);
  expect(m.structure.stages[1].assignments[0].required).toBe(true);
  expect(
    new Set(
      m.requirements.items
        .filter((r: { kind: string }) => r.kind === "speaker")
        .map((r: { id: string }) => r.id),
    ).size,
  ).toBe(5);
});
