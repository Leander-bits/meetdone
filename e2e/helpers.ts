import { sampleResponse } from "./sample-response";
import { translate, type Locale } from "../lib/i18n";
import { expect, type Locator, type Page } from "@playwright/test";
export async function english(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "EN", exact: true }).click();
}
export async function details(page: Page, name = "My custom meeting") {
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await page.getByLabel("Meeting name", { exact: true }).fill(name);
  await page.getByLabel("Date", { exact: true }).fill("2026-09-22");
  await setTime(page, "Start time", "09:00");
  await setTime(page, "End time", "09:30");
  await addParticipant(page, "zhaojiaheng@superintelligence.com");
  await expect(page.locator("[data-participant-chip]").first()).toHaveText("zhaojiaheng");
  await page.getByLabel("Timezone", { exact: true }).selectOption("Europe/Berlin");
  await expect(page.getByText("UTC+02:00", { exact: false }).first()).toBeVisible();
}
export async function configuration(page: Page, template = "Product Launch Decision") {
  await details(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const structure =
    template === "Project Retrospective"
      ? "Stage Progression"
      : template === "Customer Progress Meeting"
        ? "Stage \u00d7 Speaker Matrix"
        : "Time Sequence";
  await page.getByRole("button", { name: structure, exact: true }).click();
}
export async function saved(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("meetdone.workspace.v1") ?? '{"meetings":[]}').meetings,
  );
}
// Exercise explicit AI requests with deterministic HTTP fixtures; no product mock mode.
export async function mockSampleAnalysis(page: Page, scenarioId = "launch-incomplete") {
  let requests = 0;
  const { scenarios } = await import("../tests/fixtures/demo");
  const scenario = scenarios.find((s) => s.id === scenarioId)!;
  await page.locator("#transcript").fill(scenario.transcript);
  await page.route("**/api/analyze-meeting", async (route) => {
    requests += 1;
    const input = route.request().postDataJSON();
    const analysis = sampleResponse(input.requirements, scenarioId);
    await route.fulfill({
      json: {
        analysis: {
          ...analysis,
          id: `ai-${scenarioId}`,
          provider: "deepseek",
          scenarioId: null,
          transcriptRevision: input.transcript.revision,
          requirementsRevision: input.requirements.revision,
          actionItems: analysis.actionItems.map((a) => ({ ...a, source: "ai" })),
          evidence: scenario.analysis.evidence.map((e) => ({
            ...e,
            transcriptRevision: input.transcript.revision,
          })),
        },
      },
    });
  });
  return () => requests;
}
export async function analyzeSample(page: Page, scenarioId = "launch-incomplete") {
  await mockSampleAnalysis(page, scenarioId);
  await page.getByRole("button", { name: "AI Analyze Meeting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AI Analysis", exact: true })).toBeVisible();
}
export async function demoComplete(page: Page) {
  await analyzeSample(page, "launch-complete");
}

export async function pointerReorder(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const source = await from.locator("[data-drag-handle]").first().boundingBox();
  const target = await to.locator("[data-drag-handle]").first().boundingBox();
  await page.mouse.move(source!.x + 12, source!.y + 15);
  await page.mouse.down();
  await page.mouse.move(source!.x + 12, source!.y + 25, { steps: 3 });
  await expect(from).toHaveAttribute("data-dragging", "true");
  await page.mouse.move(target!.x + 12, target!.y + 15, { steps: 12 });
  await expect(to).toHaveAttribute("data-drag-over", "true");
  await page.mouse.up();
}
export async function keyboardReorder(page: Page, from: Locator, to: Locator, direction: string) {
  await from.locator("[data-drag-handle]").first().scrollIntoViewIfNeeded();
  await from.locator("[data-drag-handle]").first().focus();
  await page.keyboard.press("Space");
  await expect(from).toHaveAttribute("data-dragging", "true");
  await page.keyboard.press(direction);
  await expect(to).toHaveAttribute("data-drag-over", "true");
  await page.keyboard.press("Space");
}

export async function setTime(page: Page, label: string, value: string, locale: Locale = "en") {
  const [hour, minute] = value.split(":");
  const group = page.getByRole("group", { name: label, exact: true });
  await group
    .getByRole("combobox", { name: `${label} \u00b7 ${translate(locale, "Hour")}`, exact: true })
    .selectOption(hour);
  await group
    .getByRole("combobox", { name: `${label} \u00b7 ${translate(locale, "Minute")}`, exact: true })
    .selectOption(minute);
}
export async function addParticipant(page: Page, email: string, locale: Locale = "en") {
  const input = page.getByRole("textbox", {
    name: translate(locale, "Participant email"),
    exact: true,
  });
  await input.fill(email);
  await input.press("Enter");
}
