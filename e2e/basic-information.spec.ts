import { addParticipant } from "./helpers";
import { test, expect } from "@playwright/test";
import { translate } from "../lib/i18n";

for (const locale of ["zh", "en"] as const) {
  test(`${locale}: basic information layout keeps state, language and responsive controls`, async ({
    page,
  }, info) => {
    await page.goto("/");
    if (locale === "en") await page.getByRole("button", { name: "EN", exact: true }).click();
    const t = (key: string) => translate(locale, key);
    await page.getByRole("button", { name: t("Create Meeting"), exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: t("Basic Information"), exact: true }),
    ).toBeVisible();
    await expect(dialog.locator("ol li")).toHaveCount(3);
    await expect(dialog.locator("ol li").first()).toHaveAttribute("aria-current", "step");
    await expect(dialog.getByRole("button", { name: t("Continue"), exact: true })).toBeDisabled();
    await page.getByLabel(t("Meeting name"), { exact: true }).fill("User content 用户内容");
    await addParticipant(page, "devi@example.com", locale);
    await page
      .getByRole("button", { name: `${t("Edit participant")}: devi@example.com`, exact: true })
      .click();
    await expect(page.getByLabel(t("Display name"), { exact: true })).toHaveValue("devi");
    await page.getByLabel(t("Display name"), { exact: true }).fill("Devi Custom");
    await addParticipant(page, "devi.new@example.com", locale);
    await expect(page.getByLabel(t("Display name"), { exact: true })).toHaveValue("Devi Custom");
    await dialog
      .getByRole("button", { name: locale === "zh" ? "EN" : "中文", exact: true })
      .click();
    const other = (key: string) => translate(locale === "zh" ? "en" : "zh", key);
    await expect(page.getByLabel(other("Meeting name"), { exact: true })).toHaveValue(
      "User content 用户内容",
    );
    await expect(page.getByLabel(other("Display name"), { exact: true })).toHaveValue(
      "Devi Custom",
    );
    await dialog
      .getByRole("button", { name: locale === "zh" ? "中文" : "EN", exact: true })
      .click();
    for (const width of [1440, 1280, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(
        dialog.getByRole("button", { name: t("Back to Home"), exact: true }),
      ).toBeVisible();
      await expect(dialog.getByRole("button", { name: t("Close"), exact: true })).toBeVisible();
      const next = await dialog
        .getByRole("button", { name: t("Continue"), exact: true })
        .boundingBox();
      expect(next!.x + next!.width / 2).toBeGreaterThan(width / 2);
      if (width === 1280 || width === 390)
        await page.screenshot({
          path: info.outputPath(`basic-${locale}-${width}.png`),
          fullPage: true,
        });
    }
    await dialog.getByRole("button", { name: t("Close"), exact: true }).click();
    await expect(
      page.getByRole("heading", { name: t("Discard this meeting?"), exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: t("Cancel"), exact: true }).click();
    await expect(page.getByLabel(t("Meeting name"), { exact: true })).toHaveValue(
      "User content 用户内容",
    );
  });
}
