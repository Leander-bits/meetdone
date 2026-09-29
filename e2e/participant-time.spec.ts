import { test, expect } from "@playwright/test";
import { addParticipant, setTime, saved } from "./helpers";
import { translate } from "../lib/i18n";

for (const locale of ["zh", "en"] as const) {
  test(`${locale}: five-minute choices and validated email chips persist correctly`, async ({
    page,
  }, info) => {
    await page.goto("/");
    if (locale === "en") await page.getByRole("button", { name: "EN", exact: true }).click();
    const t = (key: string) => translate(locale, key);
    await page.getByRole("button", { name: t("Create Meeting"), exact: true }).click();
    await page.getByLabel(t("Meeting name"), { exact: true }).fill("Time and participants");
    await page.getByLabel(t("Date"), { exact: true }).fill("2026-10-01");
    for (const label of ["Start time", "End time"]) {
      const group = page.getByRole("group", { name: t(label), exact: true });
      await expect(group.getByRole("combobox").last().locator("option:not([disabled])")).toHaveText(
        ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"],
      );
      await expect(
        group.getByRole("combobox").first().locator("option:not([disabled])"),
      ).toHaveCount(24);
    }
    await setTime(page, t("Start time"), "20:20", locale);
    await setTime(page, t("End time"), "19:20", locale);
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
      t("End time must be later than start time"),
    );
    await setTime(page, t("End time"), "20:55", locale);
    const next = page.getByRole("button", { name: t("Continue"), exact: true });
    await expect(next).toBeDisabled();
    const email = page.getByRole("textbox", { name: t("Participant email"), exact: true });
    for (const invalid of ["not-an-email", "a@@example.com", "a@", "a@example"]) {
      await email.fill(invalid);
      await email.press("Enter");
      await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
        t("Enter a valid email address"),
      );
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("[data-participant-chip]")).toHaveCount(0);
    }
    await addParticipant(page, "zhaojiaheng01@gmail.com", locale);
    await expect(email).toHaveValue("");
    await expect(page.locator("[data-participant-chip]")).toHaveText("zhaojiaheng01");
    await expect(next).toBeEnabled();
    await addParticipant(page, "ZHAOJIAHENG01@gmail.com", locale);
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
      t("This participant has already been added"),
    );
    await expect(page.locator("[data-participant-chip]")).toHaveCount(1);
    await expect(next).toBeDisabled();
    await addParticipant(page, "sunhe04@gmail.com", locale);
    await expect(page.locator("[data-participant-chip]")).toHaveText(["zhaojiaheng01", "sunhe04"]);
    await email.fill("pending@example.com");
    await expect(next).toBeDisabled();
    await email.fill("");
    await expect(next).toBeEnabled();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`chips-${locale}-${width}.png`),
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: `${t("Remove participant")}: sunhe04@gmail.com`, exact: true })
      .click();
    await page
      .getByRole("button", {
        name: `${t("Remove participant")}: zhaojiaheng01@gmail.com`,
        exact: true,
      })
      .click();
    await expect(next).toBeDisabled();
    await addParticipant(page, "zhaojiaheng01@gmail.com", locale);
    await addParticipant(page, "sunhe04@gmail.com", locale);
    await next.click();
    await page.getByRole("button", { name: t("Product Launch Decision"), exact: true }).click();
    await next.click();
    await page.getByRole("button", { name: t("Time Sequence"), exact: true }).click();
    await page.getByRole("button", { name: t("Create Meeting"), exact: true }).click();
    await page.waitForURL(/\/meetings\//);
    const m = (await saved(page))[0];
    expect(m.startTime).toBe("20:20");
    expect(m.endTime).toBe("20:55");
    expect(m.participants.map((p: { email: string; name: string }) => [p.email, p.name])).toEqual([
      ["zhaojiaheng01@gmail.com", "zhaojiaheng01"],
      ["sunhe04@gmail.com", "sunhe04"],
    ]);
  });
}
