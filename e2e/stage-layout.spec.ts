import { test, expect } from "@playwright/test";
import { english, configuration, keyboardReorder, saved } from "./helpers";
import { translate } from "../lib/i18n";

for (const locale of ["zh", "en"] as const) {
  test(`${locale}: stage presentation preserves goals, numbering and edit persistence`, async ({
    page,
  }, info) => {
    await english(page);
    await configuration(page, "Project Retrospective");
    if (locale === "zh")
      await page.getByRole("dialog").getByRole("button", { name: "中文", exact: true }).click();
    const t = (key: string) => translate(locale, key);
    const editor = page.locator('[data-structure-editor="stages"]');
    const rows = editor.locator('[data-sortable^="stages/"]');
    await editor.getByRole("button", { name: t("Add stage"), exact: true }).click();
    await rows
      .last()
      .getByRole("textbox", { name: `${t("Stage")} 6`, exact: true })
      .fill("Custom review");
    await rows
      .last()
      .getByLabel(`${t("Goal")} 1`, { exact: true })
      .fill("Keep user text");
    await expect(
      rows.last().getByRole("button", { name: `${t("Remove goal")} 1`, exact: true }),
    ).toHaveCount(0);
    await rows
      .last()
      .getByRole("button", { name: t("Add Goal"), exact: true })
      .click();
    await expect(rows.last().locator("[data-item-number]")).toHaveText(["6.", "a.", "b."]);
    await rows
      .last()
      .getByRole("button", { name: `${t("Remove goal")} 2`, exact: true })
      .click();
    await keyboardReorder(page, rows.nth(5), rows.nth(4), "ArrowUp");
    await expect(editor.getByLabel(`${t("Stage")} 5`, { exact: true })).toHaveValue(
      "Custom review",
    );
    await editor.getByRole("button", { name: `${t("Remove stage")} 6`, exact: true }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await rows.last().scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`stages-${locale}-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: t("Create Meeting"), exact: true }).click();
    await page.waitForURL(/\/meetings\//);
    const meeting = (await saved(page))[0];
    expect(meeting.structure.stages[4].name).toBe("Custom review");
    expect(meeting.structure.stages[4].goals[0].text).toBe("Keep user text");
    await page.getByRole("button", { name: t("Edit"), exact: true }).click();
    await expect(editor.getByLabel(`${t("Stage")} 5`, { exact: true })).toHaveValue(
      "Custom review",
    );
    await expect(rows.last().getByLabel(`${t("Goal")} 1`, { exact: true })).toHaveValue(
      "Keep user text",
    );
  });
}
