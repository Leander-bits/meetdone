import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("meetdone.language", "en"));
});

test("demo moves from four blockers to a ready meeting and persisted summary", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Try Demo Meeting" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
  await page.getByRole("link", { name: "Try Demo Meeting" }).click();
  await page.getByRole("button", { name: "Prepare to End Meeting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Meeting cannot end yet" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("gaps.png"), fullPage: true });
  await page.getByRole("button", { name: "Continue Discussion" }).click();
  await page.getByRole("button", { name: /Scenario B/ }).click();
  await page.getByRole("button", { name: "Use Demo Analysis" }).click();
  await page.getByRole("button", { name: "Prepare to End Meeting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ready to end meeting" })).toBeVisible();
  await page.getByRole("button", { name: "End Meeting & Generate Summary" }).click();
  await expect(page.getByRole("heading", { name: "Meeting summary" })).toBeVisible();
  await expect(page.getByText("Readiness: Ready", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "View Summary" }).click();
  await expect(page.getByRole("heading", { name: "Meeting summary" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Jordan · Sales", exact: true })).toBeVisible();
});

test("exception reason is required and ending preserves blocked readiness", async ({ page }) => {
  await page.goto("/meetings/demo-launch");
  await page.getByRole("button", { name: "Prepare to End Meeting", exact: true }).click();
  await page.getByRole("button", { name: "End with Exception", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "End with Exception", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("textbox").fill("Host accepts these risks pending written confirmation.");
  await dialog.getByRole("button", { name: "End with Exception", exact: true }).click();
  await expect(page.getByText("Readiness: Blocked", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Host accepts these risks pending written confirmation."),
  ).toHaveCount(4);
});

test("custom transcripts are saved and cannot run fixture analysis", async ({ page }) => {
  await page.goto("/meetings/demo-launch");
  await page.getByRole("button", { name: "Transcript", exact: true }).click();
  await page
    .getByLabel("Transcript text")
    .fill("This is my own meeting, with no predefined evidence.");
  await page.getByRole("button", { name: "Use Demo Analysis" }).click();
  await expect(page.getByText(/Load a demo scenario to use demo analysis/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Transcript", exact: true }).click();
  await expect(page.getByLabel("Transcript text")).toHaveValue(
    "This is my own meeting, with no predefined evidence.",
  );
  await page.getByRole("button", { name: "Prepare to End Meeting", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "End with Exception", exact: true }),
  ).toBeDisabled();
});

test("create from a template, edit requirements, and recover invalid storage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Project Retrospective/ })
    .click();
  await page.getByLabel("Meeting title").fill("Delivery retrospective");
  await page.getByRole("button", { name: "Define requirements" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create Meeting", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Delivery retrospective" })).toBeVisible();
  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Goals 1", exact: true })
    .fill("Understand our biggest delivery bottleneck");
  await expect(
    page.getByRole("button", { name: "Prepare to End Meeting", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save requirements" }).click();
  await expect(
    page.getByRole("button", { name: "Prepare to End Meeting", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Goals 1", exact: true })).toHaveValue(
    "Understand our biggest delivery bottleneck",
  );
  await page.evaluate(() => localStorage.setItem("meetdone.workspace.v1", "broken"));
  await page.goto("/");
  await expect(page.getByText(/Saved data could not be read/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Try Demo Meeting" })).toBeVisible();
});

test("mobile workspace stays within viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/meetings/demo-launch");
  await expect(
    page.getByRole("button", { name: "Prepare to End Meeting", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
});

test("action repairs reduce blockers and non-deferrable follow-ups keep the decision blocked", async ({
  page,
}) => {
  await page.goto("/meetings/demo-launch");
  await page.getByRole("button", { name: "Action Items", exact: true }).click();
  await page.getByLabel("Action 1 Owner", { exact: true }).fill("Jordan · Sales");
  await page.getByLabel("Action 2 Deadline", { exact: true }).fill("2026-09-24");
  await page.getByRole("button", { name: "Prepare to End Meeting", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  const decision = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Make the final Go / No-Go decision" }) });
  await decision.getByRole("button", { name: "Convert to Action Item" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/does not allow deferral/)).toBeVisible();
  await dialog.getByLabel("Owner", { exact: true }).fill("Maya");
  await dialog.getByLabel("Deadline", { exact: true }).fill("2026-09-25");
  await dialog.getByRole("button", { name: "Create action item" }).click();
  await page.getByRole("button", { name: "Prepare to End Meeting", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Meeting cannot end yet" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Action Items", exact: true }).click();
  await expect(page.getByText("Linked to gap", { exact: true })).toBeVisible();
});
