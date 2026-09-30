import { expect, test } from "@playwright/test";
import { configuration, english, saved, analyzeSample } from "./helpers";
import { translate } from "../lib/i18n";

for (const locale of ["zh", "en"] as const) {
  test(`${locale}: product information, embedded review and fresh samples are accessible`, async ({
    page,
  }, info) => {
    await page.goto("/");
    if (locale === "en") await page.getByRole("button", { name: "EN", exact: true }).click();
    const section = page.getByRole("region", {
      name: locale === "zh" ? "测试与产品说明" : "Try it and product details",
    });
    await expect(
      section
        .getByText(/Mock:/)
        .or(section.getByText(/Mock：/))
        .first(),
    ).toBeVisible();
    await expect(section.getByRole("button")).toHaveCount(3);
    await section.locator("summary").first().click();
    await expect(section.getByText(/50,000/)).toBeVisible();
    await expect(section.getByText(/localStorage/)).toBeVisible();
    await section.locator("summary").last().click();
    const frame = page.frameLocator("iframe");
    await expect(frame.locator("h1")).toContainText("MeetDone");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await section.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`product-info-${locale}-${width}.png`),
        fullPage: true,
      });
    }
    await section.getByRole("button").first().click();
    await page.waitForURL(/\/meetings\//);
    const m = (await saved(page))[0];
    expect(m.id).not.toBe("demo-launch");
    expect(m.analysis).toBeNull();
    const t = (s: string) => translate(locale, s);
    const text = page.getByRole("textbox", { name: t("Transcript"), exact: true });
    const before = await text.inputValue();
    await page.getByRole("button", { name: t("Append sample follow-up"), exact: true }).click();
    expect((await text.inputValue()).length).toBeGreaterThan(before.length);
    await expect(page.locator("#analysis-results")).toHaveCount(0);
  });
}

test("save template stays near the goal; creation and editing preserve a single goal document", async ({
  page,
}, info) => {
  await english(page);
  await configuration(page);
  const goal = page.getByLabel("Meeting Goals", { exact: true });
  const text =
    "Review readiness\nTopic: Technical risks\nConclusion: Agree on the release assessment\nDecision: Launch or delay\nAction: Publish the release plan";
  await goal.fill(text);
  const save = page.getByRole("button", { name: "Save as Template", exact: true });
  const goalBox = await goal.boundingBox();
  const saveBox = await save.boundingBox();
  expect(Math.abs(saveBox!.y - goalBox!.y)).toBeLessThan(200);
  await save.click();
  await page.getByLabel("Template name", { exact: true }).fill("Visible goals only");
  await page.getByRole("button", { name: "Save Template", exact: true }).click();
  await expect(page.getByText("Template saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meeting Rules", exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("goal-document-create.png"), fullPage: true });
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page.locator('section[aria-labelledby="requirements-heading"]')).toContainText(text);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(goal).toHaveValue(text);
  await page.screenshot({ path: info.outputPath("goal-document-edit.png"), fullPage: true });
  await goal.fill("Replacement outcome");
  await page.getByRole("button", { name: "Save requirements", exact: true }).click();
  const m = (await saved(page))[0];
  expect(
    m.requirements.items.some((r: { kind: string }) =>
      ["action", "decision", "conclusion"].includes(r.kind),
    ),
  ).toBe(false);
  expect(m.analysis).toBeNull();
});

test("sample follow-up invalidates prior analysis and can be analyzed again", async ({ page }) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  await analyzeSample(page);
  await page.getByRole("button", { name: "Append sample follow-up", exact: true }).click();
  await expect(page.locator("#analysis-results")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Not analyzed");
});
