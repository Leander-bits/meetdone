import { expect, type Page } from "@playwright/test";
export async function english(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "EN", exact: true }).click();
}
export async function details(page: Page, name = "My custom meeting") {
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await page.getByLabel("Meeting name", { exact: true }).fill(name);
  await page.getByLabel("Date", { exact: true }).fill("2026-09-22");
  await page.getByLabel("Start time", { exact: true }).fill("09:00");
  await page.getByLabel("End time", { exact: true }).fill("09:30");
  await page.getByLabel("Email 1", { exact: true }).fill("zhaojiaheng@superintelligence.com");
  await expect(page.getByLabel("Display name 1", { exact: true })).toHaveValue("zhaojiaheng");
  await page.getByLabel("Timezone", { exact: true }).selectOption("Europe/Berlin");
  await expect(page.getByText("UTC+02:00", { exact: false }).first()).toBeVisible();
}
export async function configuration(page: Page, template = "Product Launch Decision") {
  await details(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
export async function saved(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("meetdone.workspace.v1") ?? '{"meetings":[]}').meetings,
  );
}
// Exercise explicit AI requests with deterministic HTTP fixtures; no product mock mode.
export async function analyzeSample(page: Page, scenarioId = "launch-incomplete") {
  const { scenarios } = await import("../tests/fixtures/demo");
  const scenario = scenarios.find((s) => s.id === scenarioId)!;
  await page.getByRole("textbox", { name: "Transcript", exact: true }).fill(scenario.transcript);
  await page.route("**/api/analyze-meeting", async (route) => {
    const input = route.request().postDataJSON();
    await route.fulfill({
      json: {
        analysis: {
          ...scenario.analysis,
          id: `ai-${scenarioId}`,
          provider: "deepseek",
          scenarioId: null,
          transcriptRevision: input.transcript.revision,
          requirementsRevision: input.requirements.revision,
          actionItems: scenario.analysis.actionItems.map((a) => ({ ...a, source: "ai" })),
          evidence: scenario.analysis.evidence.map((e) => ({
            ...e,
            transcriptRevision: input.transcript.revision,
          })),
        },
      },
    });
  });
  await page.getByRole("button", { name: "AI Analyze Meeting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AI Analysis", exact: true })).toBeVisible();
}
export async function demoComplete(page: Page) {
  await analyzeSample(page, "launch-complete");
}
