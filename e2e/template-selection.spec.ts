import { test, expect } from "@playwright/test";
import { details, english } from "./helpers";
import { translate } from "../lib/i18n";

for (const locale of ["zh", "en"] as const) {
  test(`${locale}: template cards preserve selection, navigation and responsive layout`, async ({
    page,
  }, info) => {
    await english(page);
    await details(page, "Template layout review");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    if (locale === "zh")
      await page.getByRole("dialog").getByRole("button", { name: "中文", exact: true }).click();
    const t = (key: string) => translate(locale, key);
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('[aria-current="step"]')).toContainText(t("Meeting Template"));
    const next = dialog.getByRole("button", { name: t("Continue"), exact: true });
    await expect(next).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: new RegExp(t("Delete Custom Template")) }),
    ).toHaveCount(0);
    const launch = dialog.getByRole("button", { name: t("Product Launch Decision"), exact: true });
    await launch.click();
    await expect(launch).toHaveAttribute("aria-pressed", "true");
    await expect(launch.locator("..")).toHaveClass(/border-primary/);
    await dialog.getByRole("button", { name: t("Back"), exact: true }).click();
    await expect(dialog.getByLabel(t("Meeting name"), { exact: true })).toHaveValue(
      "Template layout review",
    );
    await next.click();
    await expect(launch).toHaveAttribute("aria-pressed", "true");
    const custom = dialog.getByRole("button", { name: t("Create New Template"), exact: true });
    await custom.click();
    await expect(custom).toHaveAttribute("aria-pressed", "true");
    await expect(launch).toHaveAttribute("aria-pressed", "false");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(next).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`templates-${locale}-${width}.png`),
        fullPage: true,
      });
    }
    await next.click();
    await expect(dialog.getByLabel(t("Meeting Goals"), { exact: true }).first()).toHaveValue("");
  });
}
