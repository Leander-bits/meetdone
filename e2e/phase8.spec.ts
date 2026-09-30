import { sampleResponse } from "./sample-response";
import { test, expect, type Page } from "@playwright/test";
import { sampleMeetings } from "../lib/sample-meetings";
import { scenarios } from "../tests/fixtures/demo";
import { configuration, english, saved } from "./helpers";

async function analyze(page: Page, incidentalOnly = false) {
  const scenario = scenarios.find((s) => s.id === "launch-complete")!;
  await page.getByRole("textbox", { name: "Transcript", exact: true }).fill(scenario.transcript);
  await page.route("**/api/analyze-meeting", async (route) => {
    const input = route.request().postDataJSON();
    const analysis = sampleResponse(input.requirements, "launch-complete");
    const actionItems = incidentalOnly
      ? ["Develop first version", "Prepare test data", "Organize meeting scenarios"].map(
          (description, i) => ({
            id: `extra-${i}`,
            description,
            owner: i ? "Lin" : "Zhao",
            deadline: null,
            status: "open",
            source: "ai",
            evidenceIds: [],
          }),
        )
      : analysis.actionItems.map((a) => ({ ...a, source: "ai", deadline: null }));
    await route.fulfill({
      json: {
        analysis: {
          ...analysis,
          actionItems,
          id: "ai-followups",
          provider: "deepseek",
          scenarioId: null,
          transcriptRevision: input.transcript.revision,
          requirementsRevision: input.requirements.revision,
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

test("three incidental deadlines remain follow-ups; ready meetings end normally", async ({
  page,
}) => {
  const m = sampleMeetings()[0];
  m.requirements.items = m.requirements.items.filter((r) => r.kind !== "action");
  await page.addInitScript((meeting) => {
    if (!localStorage.getItem("meetdone.workspace.v1"))
      localStorage.setItem(
        "meetdone.workspace.v1",
        JSON.stringify({ version: 3, meetings: [meeting] }),
      );
  }, m);
  await english(page);
  await page.goto("/meetings/demo-launch");
  await analyze(page, true);
  await expect(page.getByRole("status")).toHaveText("Ready to End");
  await expect(
    page.getByRole("heading", { name: "Blocking Issues (0)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Follow-up Issues (3)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Follow-up Issues", exact: true }).getByRole("article"),
  ).toHaveCount(3);
  await expect(page.getByText("Deadline not specified.", { exact: true })).toHaveCount(3);
  await page.getByText("Action Items (3)", { exact: true }).click();
  for (const n of [1, 2, 3]) {
    const label = page.getByLabel(`Action ${n} Deadline`, { exact: true }).locator("..");
    await expect(label.locator(".text-destructive")).toHaveCount(0);
    await expect(label.getByText("Not specified", { exact: false })).toBeVisible();
  }
  const questions = page.locator("#analysis-results li");
  const actionAnswer = questions
    .filter({ hasText: "Do all Action Items have an owner and deadline?" })
    .getByText("No", { exact: true });
  await expect(actionAnswer).toHaveClass(/text-muted-foreground/);
  await expect(
    questions
      .filter({ hasText: "Are there unresolved blockers preventing the meeting from ending?" })
      .getByText("No", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Ready to End");
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.getByRole("heading", { name: "后续事项 (3)", exact: true })).toBeVisible();
  await expect(page.getByText("未指定截止日期。", { exact: true })).toHaveCount(3);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .locator("#analysis-results")
    .getByRole("button", { name: "End Meeting", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.md$/);
  const ended = (await saved(page))[0];
  expect(ended.lifecycle).toBe("ended");
  expect(ended.summary.readiness).toBe("READY");
  expect(ended.summary.acceptedExceptions).toEqual([]);
});

test("action validation switches persist through creation, custom templates and editing", async ({
  page,
}) => {
  await english(page);
  await configuration(page);
  await page
    .getByLabel("Meeting Goals", { exact: true })
    .fill("Confirm release\nAction [owner optional; deadline optional]: Send the release notice");
  await page.getByRole("button", { name: "Save as Template", exact: true }).click();
  await page.getByLabel("Template name", { exact: true }).fill("Flexible actions");
  await page.getByRole("button", { name: "Save Template", exact: true }).click();
  const templates = await page.evaluate(
    () => JSON.parse(localStorage.getItem("meetdone.templates.v1")!).templates,
  );
  expect(templates[0].rules).toEqual([]);
  expect(templates[0].defaultGoals[0].label).toContain("owner optional; deadline optional");
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await page.waitForURL(/\/meetings\//);
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const goal = page.getByLabel("Meeting Goals", { exact: true });
  await expect(goal).toHaveValue(
    "Confirm release\nAction [owner optional; deadline optional]: Send the release notice",
  );
  await goal.fill("Confirm release\nAction [deadline optional]: Send the release notice");
  await page.getByRole("button", { name: "Save requirements", exact: true }).click();
  expect(
    (await saved(page))[0].requirements.items.find((r: { kind: string }) => r.kind === "action"),
  ).toMatchObject({ requireOwner: true, requireDeadline: false });
});

test("required deadlines still block until explicitly disabled and reanalyzed", async ({
  page,
}) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  await analyze(page);
  await expect(page.getByRole("status")).toHaveText("Blocked");
  await expect(
    page.getByRole("heading", { name: "Blocking Issues (2)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const goal = page.getByLabel("Meeting Goals", { exact: true });
  await goal.fill(
    (await goal.inputValue())
      .replaceAll("\u884c\u52a8\u9879:", "Action [deadline optional]:")
      .replaceAll("\u884c\u52a8\u9879\uff1a", "Action [deadline optional]:"),
  );
  await page.getByRole("button", { name: "Save requirements", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Not analyzed");
  await analyze(page);
  await expect(page.getByRole("status")).toHaveText("Ready to End");
  await expect(
    page.getByRole("heading", { name: "Blocking Issues (0)", exact: true }),
  ).toBeVisible();
  const rows = page.locator("#analysis-results .divide-y").first();
  for (const name of [
    "\u53d1\u9001\u53d1\u5e03\u901a\u77e5",
    "\u53d1\u5e03\u4e0a\u7ebf\u76d1\u63a7\u6e05\u5355",
  ]) {
    await expect(
      rows.locator(":scope > div").filter({ hasText: name }).getByText("Complete", { exact: true }),
    ).toBeVisible();
  }
});
