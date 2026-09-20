import { test, expect, type Page } from "@playwright/test";
import { details, english, saved, keyboardReorder } from "./helpers";
import { translate } from "../lib/i18n";

async function selection(page: Page, count = 2) {
  await english(page);
  await details(page);
  for (let i = 2; i <= count; i++) {
    await page.getByRole("button", { name: "Add participant", exact: true }).click();
    await page.getByLabel(`Email ${i}`, { exact: true }).fill(`person${i}@example.com`);
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Product Launch Decision", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

test("Chinese creation uses goal tooltips, examples and compact speaker controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "创建会议", exact: true }).click();
  for (const [name, value] of [
    ["会议名称", "用户填写的会议"],
    ["日期", "2026-09-22"],
    ["开始时间", "09:00"],
    ["结束时间", "09:30"],
    ["邮箱 1", "devi@example.com"],
  ]) {
    await page.getByLabel(name, { exact: true }).fill(value);
  }
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page
    .getByRole("button", { name: translate("zh", "Product Launch Decision"), exact: true })
    .click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(page.locator("[data-structure-editor]")).toHaveCount(0);
  await page
    .getByRole("button", { name: translate("zh", "Stage Progression"), exact: true })
    .click();
  const firstStage = page.locator('[data-sortable^="stages/"]').first();
  await expect(firstStage.getByText("目标", { exact: true })).toBeVisible();
  const plus = firstStage.getByRole("button", { name: "添加目标", exact: true });
  await expect(plus).toHaveText("");
  await expect(plus).toHaveAttribute("title", "添加目标");
  await plus.click();
  await expect(firstStage.getByRole("textbox", { name: "目标 2", exact: true })).toHaveAttribute(
    "placeholder",
    "例如：确认客户反馈",
  );
  await expect(page.getByText(/建议目标|可不填写|上移|下移/)).toHaveCount(0);
  await page
    .getByRole("button", { name: translate("zh", "Speaker Sequence"), exact: true })
    .click();
  await expect(page.getByRole("checkbox", { name: "必须发言", exact: true })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "角色: devi", exact: true })).toBeVisible();
});

test("nested matrix ordering preserves assignments and supports keyboard cancellation", async ({
  page,
}) => {
  await selection(page, 3);
  await page.getByRole("button", { name: "Stage × Speaker Matrix", exact: true }).click();
  const stage = page.locator('[data-sortable^="stages/"]').first();
  const assign = stage.getByRole("combobox", {
    name: "Assign participant: Background",
    exact: true,
  });
  for (let i = 0; i < 3; i++)
    await assign.selectOption((await assign.locator("option").nth(1).getAttribute("value")) ?? "");
  const participants = stage.locator("[data-sortable]");
  const id = await participants.first().getAttribute("data-sortable");
  await participants.first().getByRole("checkbox").uncheck();
  await keyboardReorder(page, participants.first(), participants.nth(1), "ArrowDown");
  await expect(participants.nth(1)).toHaveAttribute("data-sortable", id!);
  await expect(participants.nth(1).getByRole("checkbox")).not.toBeChecked();
  await expect(participants.locator("[data-item-number]")).toHaveText(["1.", "2.", "3."]);
  const handle = participants.nth(1).locator("[data-drag-handle]");
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(participants.nth(1)).toHaveAttribute("data-dragging", "true");
  await page.keyboard.press("ArrowDown");
  await expect(participants.nth(2)).toHaveAttribute("data-drag-over", "true");
  await page.keyboard.press("Escape");
  await expect(participants.nth(1)).toHaveAttribute("data-sortable", id!);
});

test("structure selection is explicit; switching keeps goals and shows only one editor", async ({
  page,
}) => {
  await selection(page);
  await expect(page.locator("[data-structure-editor]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create Meeting", exact: true })).toBeDisabled();
  for (const [name, type] of [
    ["Time Sequence", "time"],
    ["Stage Progression", "stages"],
    ["Stage × Speaker Matrix", "matrix"],
    ["Speaker Sequence", "speaker"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("[data-structure-editor]")).toHaveCount(1);
    await expect(page.locator("[data-structure-editor]")).toHaveAttribute(
      "data-structure-editor",
      type,
    );
    await expect(page.getByRole("button", { name: /Move up|Move down/ })).toHaveCount(0);
    if (type !== "speaker") {
      const row = page.locator("[data-sortable]").first();
      await expect(row.getByText("Goals", { exact: true })).toBeVisible();
      await expect(row.getByText("Optional", { exact: true })).toHaveCount(0);
      const input = row.getByRole("textbox", { name: "Goal 1", exact: true });
      await expect(input).toHaveAttribute("placeholder", "e.g. Confirm launch risks");
      if (type === "time") await input.fill("User-entered launch goal");
      const plus = row.getByRole("button", { name: "Add Goal", exact: true });
      await expect(plus).toHaveText("");
      await expect(plus).toHaveAttribute("title", "Add Goal");
      await plus.click();
      await expect(row.getByRole("textbox", { name: "Goal 2", exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "Remove goal 1", exact: true })).toHaveCount(0);
    }
  }
  await page.getByRole("button", { name: "Time Sequence", exact: true }).click();
  await expect(
    page.locator('[data-sortable^="segments/"]').first().getByLabel("Goal 1", { exact: true }),
  ).toHaveValue("User-entered launch goal");
});

for (const locale of ["en", "zh"] as const) {
  test(`${locale}: shared circular speaker flow, independent controls, keyboard reorder and editing`, async ({
    page,
  }, info) => {
    // Persist the locale before opening the modal; the global language control is outside it.
    await selection(page, 3);
    await page.getByRole("button", { name: "Speaker Sequence", exact: true }).click();
    const rows = page.locator('[data-sortable^="speakers/"]');
    const firstId = await rows.first().getAttribute("data-sortable");
    const checkbox = rows.first().getByRole("checkbox", { name: "Required", exact: true });
    await checkbox.uncheck();
    await rows.first().getByRole("combobox").selectOption("Sales");
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await rows.first().getByRole("combobox").selectOption("Other");
    await expect(checkbox).toBeChecked();
    await rows.first().locator("[data-drag-handle]").focus();
    await page.keyboard.press("Space");
    await expect(rows.first()).toHaveAttribute("data-dragging", "true");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await expect(rows.nth(1)).toHaveAttribute("data-sortable", firstId!);
    await expect(rows.locator("[data-item-number]")).toHaveText(["1.", "2.", "3."]);
    await expect(rows.first().locator("[data-speaker-arrow]")).toHaveAttribute(
      "data-to",
      firstId!.slice(9),
    );
    await expect(rows.last().locator("[data-speaker-arrow]")).toHaveCount(0);
    await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
    await page.waitForURL(/\/meetings\//);
    const meeting = (await saved(page))[0];
    expect(meeting.structure.speakerOrder[1]).toBe(firstId!.slice(9));
    if (locale === "zh") await page.getByRole("button", { name: "中文", exact: true }).click();
    const t = (key: string) => translate(locale, key);
    await page.getByRole("button", { name: t("Edit"), exact: true }).click();
    await expect(page.locator("[data-speaker-node]")).toHaveCount(3);
    await expect(rows.first().getByRole("checkbox")).toHaveAccessibleName(
      locale === "zh" ? "必须发言" : "Required",
    );
    await expect(rows.first().getByRole("combobox").locator("option")).toHaveText(
      locale === "zh"
        ? ["产品", "技术", "销售", "客户", "其他"]
        : ["Product", "Engineering", "Sales", "Customer", "Other"],
    );
    const circle = await page
      .locator("[data-speaker-node]")
      .first()
      .evaluate((el) => ({
        width: el.clientWidth,
        height: el.clientHeight,
        radius: getComputedStyle(el).borderRadius,
      }));
    expect(circle.width).toBe(circle.height);
    expect(parseFloat(circle.radius)).toBeGreaterThan(40);
    await page.getByRole("button", { name: t("Time Sequence"), exact: true }).click();
    const row = page.locator('[data-sortable^="segments/"]').first();
    await expect(row.getByText(t("Goals"), { exact: true })).toBeVisible();
    await expect(row.getByRole("textbox", { name: `${t("Goal")} 1`, exact: true })).toHaveAttribute(
      "placeholder",
      t("e.g. Confirm launch risks"),
    );
    await expect(row.getByRole("button", { name: t("Add Goal"), exact: true })).toHaveAttribute(
      "title",
      t("Add Goal"),
    );
    await expect(page.getByText(/建议目标|Recommended goals|Suggested Goals/)).toHaveCount(0);
    await page.getByRole("button", { name: t("Speaker Sequence"), exact: true }).click();
    await page.screenshot({ path: info.outputPath(`speaker-${locale}.png`), fullPage: true });
    await page.getByRole("button", { name: t("Save requirements"), exact: true }).click();
    expect((await saved(page))[0].structure.speakerOrder).toEqual(meeting.structure.speakerOrder);
  });
}

test("many speakers wrap without page overflow and remain draggable on touch screens", async ({
  page,
  browser,
}, info) => {
  await selection(page, 8);
  await page.getByRole("button", { name: "Speaker Sequence", exact: true }).click();
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const nodes = page.locator("[data-speaker-node]");
    const first = await nodes.first().boundingBox();
    const last = await nodes.last().boundingBox();
    expect(last!.y).toBeGreaterThan(first!.y);
    await page.screenshot({ path: info.outputPath(`speakers-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await page.waitForURL(/\/meetings\//);
  const records = await page.evaluate(() => localStorage.getItem("meetdone.workspace.v1"));
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript((value) => {
    localStorage.setItem("meetdone.workspace.v1", value!);
    localStorage.setItem("meetdone.language", "en");
  }, records);
  const mobile = await context.newPage();
  await mobile.goto(page.url());
  await mobile.getByRole("button", { name: "Edit", exact: true }).click();
  const rows = mobile.locator('[data-sortable^="speakers/"]');
  const firstId = await rows.first().getAttribute("data-sortable");
  await rows.first().scrollIntoViewIfNeeded();
  const handle = await rows.first().locator("[data-drag-handle]").boundingBox();
  const target = await rows.nth(1).locator("[data-drag-handle]").boundingBox();
  const cdp = await context.newCDPSession(mobile);
  const point = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: point(handle!.x + 12, handle!.y + 15),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: point(handle!.x + 12, handle!.y + 25),
  });
  await expect(rows.first()).toHaveAttribute("data-dragging", "true");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: point(target!.x + 12, target!.y + 15),
  });
  await expect(rows.nth(1)).toHaveAttribute("data-drag-over", "true");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(rows.nth(1)).toHaveAttribute("data-sortable", firstId!);
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await context.close();
});
