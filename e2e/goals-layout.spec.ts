import { test, expect } from "@playwright/test";
import { details, english } from "./helpers";
import { translate } from "../lib/i18n";

for (const locale of ["zh", "en"] as const) {
  test(`${locale}: goals and structure presentation preserves dynamic fields and selection`, async ({
    page,
  }, info) => {
    await english(page);
    await details(page);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Create New Template", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const dialog = page.getByRole("dialog");
    if (locale === "zh") await dialog.getByRole("button", { name: "中文", exact: true }).click();
    const t = (key: string) => translate(locale, key);
    await expect(dialog.locator('[aria-current="step"]')).toContainText(t("Goals and Structure"));
    await expect(page.locator("[data-structure-editor]")).toHaveCount(0);
    const goal = dialog.getByLabel(`${t("Goal")} 1`, { exact: true }).first();
    await expect(goal).toHaveJSProperty("tagName", "TEXTAREA");
    await expect(
      dialog.getByRole("button", { name: `${t("Remove goal")} 1`, exact: true }),
    ).toBeDisabled();
    await goal.fill("User goal stays unchanged");
    await dialog.getByRole("button", { name: t("Add Goal"), exact: true }).click();
    await dialog.getByLabel(`${t("Goal")} 2`, { exact: true }).fill("Second goal");
    await dialog.getByRole("button", { name: `${t("Remove goal")} 2`, exact: true }).click();
    await expect(dialog.getByLabel(`${t("Goal")} 2`, { exact: true })).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: t("Create Meeting"), exact: true }),
    ).toBeDisabled();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`goals-${locale}-${width}.png`),
        fullPage: true,
      });
    }
    for (const [type, name] of [
      ["time", "Time Sequence"],
      ["speaker", "Speaker Sequence"],
      ["stages", "Stage Progression"],
      ["matrix", "Stage × Speaker Matrix"],
    ]) {
      const card = dialog.getByRole("button", { name: t(name), exact: true });
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await expect(card).toHaveClass(/border-primary/);
      await expect(page.locator("[data-structure-editor]")).toHaveCount(1);
      await expect(page.locator(`[data-structure-editor="${type}"]`)).toBeVisible();
    }
    await dialog.getByRole("button", { name: t("Back"), exact: true }).click();
    await dialog.getByRole("button", { name: t("Continue"), exact: true }).click();
    await expect(goal).toHaveValue("User goal stays unchanged");
    await expect(
      dialog.getByRole("button", { name: t("Stage × Speaker Matrix"), exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
}
