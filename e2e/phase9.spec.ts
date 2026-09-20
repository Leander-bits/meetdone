import { test, expect, type Page, type Locator } from "@playwright/test";
import { english, mockSampleAnalysis, saved } from "./helpers";
import { translate, type Locale } from "../lib/i18n";

const readiness = (page: Page) => page.locator("[data-readiness-action]");
async function fullWidth(locator: Locator, viewport: number, padding = 0) {
  await expect
    .poll(async () => (await locator.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(viewport - padding - 2);
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(viewport - padding - 2);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test("prepare runs AI once and reveals blocked actions without a prior AI click", async ({
  page,
}) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  const requests = await mockSampleAnalysis(page);
  expect(requests()).toBe(0);
  await readiness(page)
    .getByRole("button", { name: "Prepare to End Meeting", exact: true })
    .click();
  await expect(
    readiness(page).getByRole("button", { name: "Not Ready to End", exact: true }),
  ).toBeVisible();
  expect(requests()).toBe(1);
  const results = page.locator("#analysis-results");
  await expect(results.getByRole("heading", { name: "AI Analysis", exact: true })).toBeVisible();
  for (const name of ["Continue Discussion", "Convert Gap to Action Item", "End with Exception"])
    await expect(results.getByRole("button", { name, exact: true })).toBeVisible();
  await results.getByRole("button", { name: "Continue Discussion", exact: true }).click();
  await expect(page.locator("#transcript")).toBeFocused();
  await page
    .locator("#transcript")
    .fill("Host: We need further discussion before making a decision.");
  await expect(
    readiness(page).getByRole("button", { name: "Prepare to End Meeting", exact: true }),
  ).toBeVisible();
  await expect(results).toHaveCount(0);
});

test("both analysis controls share pending state, errors and retry", async ({ page }) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/analyze-meeting", async (route) => {
    requests += 1;
    await gate;
    await route.fulfill({ status: 503, json: { error: "MISSING_API_KEY" } });
  });
  await readiness(page)
    .getByRole("button", { name: "Prepare to End Meeting", exact: true })
    .click();
  await expect(
    readiness(page).getByRole("button", { name: "Analyzing", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .locator('section[aria-labelledby="transcript-heading"]')
      .getByRole("button", { name: "Analyzing", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "AI analysis is temporarily unavailable",
  );
  expect(requests).toBe(1);
  await expect(page.locator("#analysis-results")).toHaveCount(0);
  await expect(
    readiness(page).getByRole("button", { name: "Prepare to End Meeting", exact: true }),
  ).toBeEnabled();
  const retries = await mockSampleAnalysis(page, "launch-complete");
  await readiness(page)
    .getByRole("button", { name: "Prepare to End Meeting", exact: true })
    .click();
  await expect(
    readiness(page).getByRole("button", { name: "End Meeting", exact: true }),
  ).toBeVisible();
  expect(retries()).toBe(1);
  await page.reload();
  await expect(page.locator("#analysis-results")).toBeVisible();
  await readiness(page)
    .getByRole("button", { name: "Prepare to End Meeting", exact: true })
    .click();
  await expect(
    readiness(page).getByRole("button", { name: "End Meeting", exact: true }),
  ).toBeVisible();
  expect(retries()).toBe(2);
});

test("prepare uses the same empty transcript validation as AI analysis", async ({ page }) => {
  await page.goto("/meetings/demo-launch");
  await page.locator("#transcript").fill("");
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/analyze-meeting")) requests += 1;
  });
  await readiness(page).getByRole("button", { name: "准备结束会议", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("请输入会议记录");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Enter a meeting transcript");
});

for (const width of [1440, 1280, 768, 390]) {
  for (const locale of ["zh", "en"] as Locale[]) {
    test(`${width}px ${locale}: full-width bilingual home, creation, editing, analysis and summary`, async ({
      page,
    }, info) => {
      test.setTimeout(60_000);
      const t = (s: string) => translate(locale, s);
      await page.setViewportSize({ width, height: 960 });
      await page.goto("/");
      if (locale === "en") await page.getByRole("button", { name: "EN", exact: true }).click();
      await expect(page.getByRole("heading", { name: "MeetDone", exact: true })).toBeVisible();
      await expect(
        page.getByText(
          t("Make sure every meeting finishes with the right discussions, decisions, and owners."),
          { exact: true },
        ),
      ).toBeVisible();
      await fullWidth(page.getByRole("main"), width);
      await page.getByRole("button", { name: t("About MeetDone"), exact: true }).click();
      await expect(page.locator("#create-help li")).toHaveText(
        [
          "Enter meeting name, time, and participants",
          "Select or create a meeting template",
          "Set meeting goals and structure",
          "Add the transcript and run AI analysis",
        ].map(t),
      );
      await page.mouse.click(5, 80);
      await expect(page.locator("#create-help")).not.toBeVisible();
      await page.getByRole("button", { name: t("Create Meeting"), exact: true }).click();
      await fullWidth(page.getByRole("dialog"), width);
      await page.getByRole("button", { name: t("Add participant"), exact: true }).click();
      await expect(
        page.getByRole("button", { name: `${t("Remove participant")} 1`, exact: true }),
      ).toHaveCount(0);
      for (const field of ["Email", "Display name"]) {
        const first = (await page.getByLabel(`${t(field)} 1`, { exact: true }).boundingBox())!;
        const second = (await page.getByLabel(`${t(field)} 2`, { exact: true }).boundingBox())!;
        expect(Math.abs(first.width - second.width)).toBeLessThan(1);
        expect(Math.abs(first.x - second.x)).toBeLessThan(1);
      }
      await noOverflow(page);
      await page.getByRole("button", { name: `${t("Remove participant")} 2`, exact: true }).click();
      await page.getByLabel(t("Meeting name"), { exact: true }).fill("用户内容 stays unchanged");
      await page.getByLabel(t("Date"), { exact: true }).fill("2026-09-22");
      await page.getByLabel(t("Start time"), { exact: true }).fill("20:20");
      await page.getByLabel(t("End time"), { exact: true }).fill("19:20");
      await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
        t("End time must be later than start time"),
      );
      await expect(page.getByRole("button", { name: t("Continue"), exact: true })).toBeDisabled();
      await page.getByLabel(t("End time"), { exact: true }).fill("20:50");
      await page.getByLabel(`${t("Email")} 1`, { exact: true }).fill("host@example.com");
      await page.getByRole("button", { name: t("Continue"), exact: true }).click();
      await page.getByRole("button", { name: t("Product Launch Decision"), exact: true }).click();
      await page.getByRole("button", { name: t("Continue"), exact: true }).click();
      await expect(
        page.getByRole("heading", { name: t("Meeting Rules"), exact: true }),
      ).toBeVisible();
      const toggle = page
        .getByRole("button", {
          name: t("Allow conversion into a follow-up action with owner and deadline"),
          exact: true,
        })
        .first();
      await expect(toggle).toHaveAttribute(
        "title",
        t("Allow conversion into a follow-up action with owner and deadline"),
      );
      await fullWidth(
        page.locator(".creation-overlay .flow-enter").first(),
        width,
        width < 640 ? 32 : width < 1024 ? 48 : 64,
      );
      await noOverflow(page);
      await page.getByRole("button", { name: t("Time Sequence"), exact: true }).click();
      await page.getByRole("button", { name: t("Create Meeting"), exact: true }).click();
      await page.waitForURL(/\/meetings\//);
      await expect(
        page.getByRole("heading", { name: "用户内容 stays unchanged", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: t("Edit"), exact: true }).click();
      await fullWidth(page.getByRole("dialog"), width);
      await noOverflow(page);
      await page.getByRole("button", { name: t("Cancel"), exact: true }).click();
      await page.goto("/meetings/demo-launch");
      await mockSampleAnalysis(page, "launch-complete");
      await readiness(page)
        .getByRole("button", { name: t("Prepare to End Meeting"), exact: true })
        .click();
      await expect(
        readiness(page).getByRole("button", { name: t("End Meeting"), exact: true }),
      ).toBeVisible();
      const results = page.locator("#analysis-results");
      await fullWidth(page.getByRole("main"), width);
      await fullWidth(results, width, width < 640 ? 32 : width < 1024 ? 48 : 64);
      for (const name of ["Continue Discussion", "Convert Gap to Action Item", "End Meeting"])
        await expect(results.getByRole("button", { name: t(name), exact: true })).toBeVisible();
      await noOverflow(page);
      const download = page.waitForEvent("download");
      await readiness(page)
        .getByRole("button", { name: t("End Meeting"), exact: true })
        .click();
      expect((await download).suggestedFilename()).toMatch(/\.md$/);
      await expect(
        page.getByRole("heading", { name: t("Meeting summary"), exact: true }),
      ).toBeVisible();
      await fullWidth(
        page.locator("[data-meeting-summary]"),
        width,
        width < 640 ? 32 : width < 1024 ? 48 : 64,
      );
      await noOverflow(page);
      expect(
        (await saved(page)).find((m: { id: string }) => m.id === "demo-launch").lifecycle,
      ).toBe("ended");
      await page.screenshot({
        path: info.outputPath(`summary-${width}-${locale}.png`),
        fullPage: true,
        animations: "disabled",
      });
    });
  }
}
