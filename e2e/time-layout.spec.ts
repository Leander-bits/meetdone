import { test, expect } from "@playwright/test";
import { english, configuration, saved } from "./helpers";
import { translate } from "../lib/i18n";

for (const locale of ["zh", "en"] as const) {
  test(`${locale}: timeline cards resize, retain goals, and wrap in creation and editing`, async ({
    page,
  }, info) => {
    await english(page);
    await configuration(page);
    if (locale === "zh")
      await page.getByRole("dialog").getByRole("button", { name: "中文", exact: true }).click();
    const t = (key: string) => translate(locale, key);
    const editor = page.locator('[data-structure-editor="time"]');
    const first = editor.locator("[data-sortable]").first();
    await first.getByLabel(`${t("Goal")} 1`, { exact: true }).fill("Keep this segment goal");
    await expect(
      first.getByRole("button", { name: `${t("Remove goal")} 1`, exact: true }),
    ).toHaveCount(0);
    await first.getByRole("slider").focus();
    await page.keyboard.press("ArrowRight");
    await expect(first.getByRole("slider")).toHaveValue("10");
    await editor.getByRole("button", { name: t("Add segment"), exact: true }).click();
    await editor.getByRole("button", { name: `${t("Remove segment")} 6`, exact: true }).click();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await first.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`time-${locale}-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: t("Create Meeting"), exact: true }).click();
    await page.waitForURL(/\/meetings\//);
    const m = (await saved(page))[0];
    expect(
      m.structure.segments.reduce((n: number, s: { minutes: number }) => n + s.minutes, 0),
    ).toBe(30);
    expect(m.structure.segments[0].goals[0].text).toBe("Keep this segment goal");
    await page.getByRole("button", { name: t("Edit"), exact: true }).click();
    await expect(page.locator("[data-timeline-cards]")).toBeVisible();
    await expect(first.getByLabel(`${t("Goal")} 1`, { exact: true })).toHaveValue(
      "Keep this segment goal",
    );
  });
}
