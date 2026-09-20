import { test, expect } from "@playwright/test";
import { details, english, saved, keyboardReorder, pointerReorder } from "./helpers";
import { translate } from "../lib/i18n";

test("matrix creation preserves per-stage assignments, ordering, goals and minimum stage", async ({
  page,
}) => {
  await english(page);
  await details(page);
  for (let i = 2; i <= 3; i++) {
    await page.getByRole("button", { name: "Add participant", exact: true }).click();
    await page.getByLabel(`Email ${i}`, { exact: true }).fill(`person${i}@example.com`);
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Customer Progress Meeting", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Stage × Speaker Matrix", exact: true }).click();
  const stages = page.locator('[data-sortable^="stages/"]');
  await expect(stages).toHaveCount(5);
  for (let i = 0; i < 5; i++)
    await expect(stages.nth(i).locator("[data-item-number]").first()).toHaveText(`${i + 1}.`);
  await keyboardReorder(page, stages.first(), stages.nth(1), "ArrowDown");
  await expect(page.getByLabel("Stage 1", { exact: true })).toHaveValue("Proposal");
  await expect(page.getByLabel("Stage 2", { exact: true })).toHaveValue("Background");
  const first = stages.first();
  const choose = first.getByRole("combobox", { name: "Assign participant: Proposal", exact: true });
  const ids = await choose
    .locator("option")
    .evaluateAll((options) => options.slice(1).map((o) => (o as HTMLOptionElement).value));
  for (const id of ids) await choose.selectOption(id);
  for (let i = 1; i < 5; i++)
    await stages
      .nth(i)
      .getByRole("combobox", { name: /Assign participant:/ })
      .selectOption(ids[0]);
  const nodes = first.locator("[data-sortable]");
  await nodes.first().getByRole("checkbox").uncheck();
  await expect(stages.nth(1).getByRole("checkbox")).toBeChecked();
  await nodes.first().getByRole("combobox").selectOption("Sales");
  await expect(
    stages.nth(1).getByRole("combobox", { name: "Role: zhaojiaheng", exact: true }),
  ).toHaveValue("Sales");
  await expect(nodes.first().getByRole("checkbox")).not.toBeChecked();
  await expect(stages.nth(1).getByRole("checkbox")).toBeChecked();
  await pointerReorder(page, nodes.first(), nodes.nth(1));
  await expect(nodes.nth(1).locator("[data-speaker-node]")).toHaveText("zhaojiaheng");
  await expect(nodes.first().locator("[data-speaker-arrow]")).toHaveAttribute("data-to", ids[0]);
  await expect(nodes.locator("[data-item-number]")).toHaveText(["1.", "2.", "3."]);
  await expect(nodes.last().locator("[data-speaker-arrow]")).toHaveCount(0);
  await first.getByRole("button", { name: "Add Goal", exact: true }).click();
  await first.getByLabel("Goal 2", { exact: true }).fill("User stage goal");
  await first.getByRole("button", { name: "Add Goal", exact: true }).click();
  await first.getByLabel("Goal 3", { exact: true }).fill("Keep this goal");
  await first.getByRole("button", { name: "Remove goal 2", exact: true }).click();
  await expect(first.getByLabel("Goal 2", { exact: true })).toHaveValue("Keep this goal");
  await expect(first.locator("[data-item-number]").nth(2)).toHaveText("b.");
  await expect(first.getByRole("button", { name: "Remove goal 1", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add stage", exact: true }).click();
  await expect(stages).toHaveCount(6);
  await expect(stages.last().getByLabel("Goal 1", { exact: true })).toHaveValue("");
  await expect(stages.last().locator("[data-speaker-node]")).toHaveCount(0);
  await page.getByLabel("Stage 6", { exact: true }).fill("Questions");
  await keyboardReorder(page, stages.last(), stages.nth(4), "ArrowUp");
  await expect(page.getByLabel("Stage 5", { exact: true })).toHaveValue("Questions");
  await page.getByRole("button", { name: "Remove stage 5", exact: true }).click();
  await expect(stages).toHaveCount(5);
  await expect(first.locator("[data-speaker-node]")).toHaveCount(3);
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await page.waitForURL(/\/meetings\//);
  const meeting = (await saved(page))[0];
  expect(meeting.structure.stages[0].assignments).toEqual([
    { participantId: ids[1], required: true },
    { participantId: ids[0], required: false },
    { participantId: ids[2], required: true },
  ]);
  expect(meeting.structure.stages[1].assignments).toEqual([
    { participantId: ids[0], required: true },
  ]);
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(first.locator("[data-speaker-node]")).toHaveText([
    "person2",
    "zhaojiaheng",
    "person3",
  ]);
  await first.getByRole("button", { name: "Remove participant: zhaojiaheng", exact: true }).click();
  await expect(stages.nth(1).locator("[data-speaker-node]")).toHaveText("zhaojiaheng");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Remove stage 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove stage 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Save requirements", exact: true }).click();
  expect((await saved(page))[0].structure.stages).toHaveLength(1);
});

for (const locale of ["zh", "en"] as const) {
  test(`${locale}: matrix and speaker sequence share nodes across desktop, tablet and mobile`, async ({
    page,
  }, info) => {
    await page.goto("/meetings/demo-customer");
    if (locale === "en") await page.getByRole("button", { name: "EN", exact: true }).click();
    const t = (key: string) => translate(locale, key);
    await page.getByRole("button", { name: t("Edit"), exact: true }).click();
    const stage = page.locator("[data-matrix-stage]").first();
    const chooser = stage.getByRole("combobox", { name: new RegExp(t("Assign participant")) });
    while ((await chooser.locator("option").count()) > 1)
      await chooser.selectOption((await chooser.locator("option").nth(1).getAttribute("value"))!);
    await expect(stage.locator("[data-speaker-node]")).toHaveCount(4);
    const style = await stage.locator("[data-speaker-node]").first().getAttribute("class");
    const required = stage.getByRole("checkbox").first();
    await expect(required).toHaveAccessibleName(locale === "zh" ? "必须发言" : "Required");
    await expect(stage.getByLabel(`${t("Goal")} 1`, { exact: true })).toHaveAttribute(
      "placeholder",
      t("e.g. Confirm launch risks"),
    );
    await expect(stage.getByRole("button", { name: t("Add Goal"), exact: true })).toHaveAttribute(
      "title",
      t("Add Goal"),
    );
    await page.getByRole("button", { name: t("Speaker Sequence"), exact: true }).click();
    await expect(page.locator("[data-speaker-node]").first()).toHaveAttribute("class", style!);
    await page.getByRole("button", { name: t("Stage × Speaker Matrix"), exact: true }).click();
    await expect(stage.locator("[data-speaker-node]")).toHaveCount(4);
    for (const width of [1440, 1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await stage.getByRole("checkbox").first().scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const first = await stage.locator("[data-speaker-node]").first().boundingBox();
      const last = await stage.locator("[data-speaker-node]").last().boundingBox();
      if (width <= 768) expect(last!.y).toBeGreaterThan(first!.y);
      else expect(last!.y).toBe(first!.y);
      await expect(
        stage.getByRole("combobox", { name: `${t("Role")}: Sun`, exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`matrix-${locale}-${width}.png`),
        fullPage: true,
      });
    }
    const rows = stage.locator("[data-sortable]");
    const id = await rows.first().getAttribute("data-sortable");
    await keyboardReorder(page, rows.first(), rows.nth(1), "ArrowDown");
    await expect(rows.nth(1)).toHaveAttribute("data-sortable", id!);
    await page.getByRole("button", { name: t("Save requirements"), exact: true }).click();
    const stored = (await saved(page)).find((m: { id: string }) => m.id === "demo-customer");
    expect(stored.structure.stages[0].assignments).toHaveLength(4);
  });
}
