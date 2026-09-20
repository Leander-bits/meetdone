import { test, expect } from "@playwright/test";
import { requirementKey } from "../lib/models";
import { freshDemo } from "../tests/fixtures/meeting-state";
import { analyzeSample, demoComplete, english, saved } from "./helpers";

test("blocked demo becomes ready after follow-up and automatically downloads Markdown", async ({
  page,
}, info) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  await analyzeSample(page);
  await expect(page.getByRole("status")).toContainText("Blocked");
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "Meeting Requirements", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Final Meeting Evaluation", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("analysis-blocked.png"), fullPage: true });
  await page.getByText("View evidence", { exact: true }).first().click();
  await expect(page.locator("blockquote").first()).toBeVisible();
  await demoComplete(page);
  await expect(page.getByRole("status")).toContainText("Ready to End");
  const downloadPromise = page.waitForEvent("download");
  await page
    .locator("#analysis-results")
    .getByRole("button", { name: "End Meeting", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("MeetDone_Mobile feature launch review_2026-09-23.md");
  await expect(page.getByRole("heading", { name: "Meeting summary", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Achieved Conclusions", exact: true }),
  ).toBeVisible();
  expect((await saved(page)).find((m: { id: string }) => m.id === "demo-launch").lifecycle).toBe(
    "ended",
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Meeting summary", exact: true })).toBeVisible();
});
test("exceptions require a reason, preserve blocked readiness and download the recorded risk", async ({
  page,
}) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  await analyzeSample(page);
  await page.getByRole("button", { name: "End with Exception", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "End with Exception", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Exception reason")
    .fill("Host accepts the risk; Sales will confirm separately.");
  const download = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End with Exception", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.md$/);
  await expect(page.getByRole("status")).toContainText("Ended with Exceptions");
  const m = (await saved(page)).find((m: { id: string }) => m.id === "demo-launch");
  expect(m.summary.readiness).toBe("BLOCKED");
  expect(m.summary.acceptedExceptions).toHaveLength(4);
});
test("conversion requires owner and deadline and does not silently defer a blocker", async ({
  page,
}) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  await analyzeSample(page);
  await page.getByRole("button", { name: "Convert Gap to Action Item", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Create action item", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Owner", { exact: true }).fill("Devi");
  await expect(
    dialog.getByRole("button", { name: "Create action item", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Deadline", { exact: true }).fill("2026-09-24");
  await dialog.getByRole("button", { name: "Create action item", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Blocked");
  const m = (await saved(page)).find((m: { id: string }) => m.id === "demo-launch");
  expect(m.actionItems.at(-1).gapId).toBeTruthy();
  await page.getByRole("button", { name: "Continue Discussion", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Transcript", exact: true })).toBeFocused();
});
test("custom AI analysis renders in one section, preserves evidence and invalidates on edits", async ({
  page,
}) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  const transcript =
    "Devi（产品）：我们讨论过上线安排，但尚未做出最终决定，需要等销售明确表达意见后再确认。";
  await page.getByRole("textbox", { name: "Transcript", exact: true }).fill(transcript);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/analyze-meeting", async (route) => {
    const input = route.request().postDataJSON();
    const r = input.requirements.items.find((r: { id: string }) => r.id === "l-decision");
    await gate;
    await route.fulfill({
      json: {
        analysis: {
          id: "ai-test",
          provider: "deepseek",
          scenarioId: null,
          transcriptRevision: input.transcript.revision,
          requirementsRevision: input.requirements.revision,
          goals: [],
          conclusions: [],
          topics: [],
          speakers: [],
          decisions: [
            {
              requirementId: r.id,
              requirementKey: requirementKey(r, input.requirements.items),
              status: "discussed",
              classification: "discussed_not_decided",
              outcome: null,
              detail: "No final decision",
              evidenceIds: ["e1"],
            },
          ],
          actionItems: [],
          unresolvedIssues: [],
          evidence: [
            {
              id: "e1",
              speaker: "Devi（产品）",
              quote: transcript.split("：")[1],
              segmentId: "line-1",
              transcriptRevision: input.transcript.revision,
            },
          ],
        },
      },
    });
  });
  await page.getByRole("button", { name: "AI Analyze Meeting", exact: true }).click();
  await expect(
    page
      .locator('section[aria-labelledby="transcript-heading"]')
      .getByRole("button", { name: "Analyzing", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByRole("heading", { name: "AI Analysis", exact: true })).toHaveCount(1);
  await expect(page.getByText("Discussed, not decided", { exact: true }).first()).toBeVisible();
  await page.getByText("View evidence", { exact: true }).first().click();
  await expect(page.locator("blockquote").first()).toContainText("尚未做出最终决定");
  await page.reload();
  await expect(page.getByRole("heading", { name: "AI Analysis", exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Transcript", exact: true })
    .fill(transcript + "新增讨论。");
  await expect(page.getByRole("heading", { name: "AI Analysis", exact: true })).toHaveCount(0);
  const m = (await saved(page)).find((m: { id: string }) => m.id === "demo-launch");
  expect(m.analysis).toBeNull();
  expect(m.completionCheck).toBeNull();
});
test("AI failure stays private without fabricating analysis or offering demo fallback", async ({
  page,
}) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  const text =
    "主持人：今天我们讨论新功能的上线时间，但还没有得到客户的明确反馈，暂时不能决定是否正式发布。";
  await page.getByRole("textbox", { name: "Transcript", exact: true }).fill(text);
  await page.route("**/api/analyze-meeting", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "MISSING_API_KEY", detail: "private provider information" },
    }),
  );
  await page.getByRole("button", { name: "AI Analyze Meeting", exact: true }).click();
  await expect(
    page.getByText("AI analysis is temporarily unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("private provider information")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Transcript", exact: true })).toHaveValue(text);
  await expect(page.getByRole("heading", { name: "AI Analysis", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Demo Analysis|Reset Demo|Live Transcription/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Not analyzed");
  const m = (await saved(page)).find((m: { id: string }) => m.id === "demo-launch");
  expect(m.analysis).toBeNull();
  expect(m.completionCheck).toBeNull();
});
test("TXT import handles 50,000 characters, invalid files and edit invalidation", async ({
  page,
}) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  const input = page.locator('input[type="file"]');
  const text = "Devi：今天讨论会议目标，所有成员需要明确自己的意见，之后我们再做最终决定。";
  await input.setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await expect(page.getByRole("textbox", { name: "Transcript", exact: true })).toHaveValue(text);
  await expect(page.getByText("notes.txt", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Not analyzed");
  await input.setInputFiles({
    name: "bad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("PDF"),
  });
  await expect(page.getByRole("textbox", { name: "Transcript", exact: true })).toHaveValue(text);
  await input.setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from([0xc3, 0x28]),
  });
  await expect(page.getByRole("textbox", { name: "Transcript", exact: true })).toHaveValue(text);
  await input.setInputFiles({
    name: "long.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("中".repeat(50_000)),
  });
  await expect(page.getByText("50,000 / 50,000", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Transcript", exact: true }).fill("中".repeat(50_001));
  await expect(
    page.getByRole("button", { name: "AI Analyze Meeting", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Transcript", exact: true })).toHaveValue(
    "中".repeat(50_001),
  );
});
test("requirement edits invalidate analysis and preserve user text across languages", async ({
  page,
}) => {
  await english(page);
  await page.goto("/meetings/demo-launch");
  await analyzeSample(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Add Goal", exact: true }).first().click();
  await page.getByLabel("Goal 2", { exact: true }).fill("不要自动翻译此目标");
  await page.getByRole("button", { name: "Save requirements", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Not analyzed");
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.getByText("不要自动翻译此目标", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByRole("button", { name: "移除目标 2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "移除目标 1", exact: true }).first(),
  ).toBeDisabled();
  await page.getByRole("button", { name: "保存要求", exact: true }).click();
  expect(
    (await saved(page)).find((m: { id: string }) => m.id === "demo-launch").goals,
  ).toHaveLength(1);
});
test("old storage and one corrupt record cannot break the home page", async ({ page }) => {
  const old: Record<string, unknown> = {
    ...freshDemo(),
    id: "legacy-meeting",
    title: "Legacy meeting",
    builtinTitle: false,
  };
  for (const key of [
    "date",
    "startTime",
    "endTime",
    "timezone",
    "participants",
    "structure",
    "goals",
  ])
    delete old[key];
  await page.addInitScript((data) => {
    if (!localStorage.getItem("seeded")) {
      localStorage.setItem(
        "meetdone.workspace.v1",
        JSON.stringify({ version: 2, meetings: [data, { id: "corrupt" }] }),
      );
      localStorage.setItem("seeded", "yes");
    }
  }, old);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Legacy meeting/ })).toBeVisible();
  await page.getByRole("link", { name: /Legacy meeting/ }).click();
  await expect(page.getByRole("textbox", { name: "会议记录", exact: true })).not.toBeEmpty();
  await expect(page.getByText("未记录会议时间", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "未记录会议结构", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByText("Schedule not recorded", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Structure not recorded", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("meetdone.workspace.recovery")),
  ).toBeTruthy();
});
test("mobile Chinese creation and English analysis fit without horizontal overflow", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "创建会议", exact: true }).click();
  await expect(page.getByLabel("会议名称", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("create-mobile-zh.png"), fullPage: true });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.goto("/meetings/demo-customer");
  await analyzeSample(page, "customer-complete");
  await expect(page.getByRole("status")).toContainText("Ready to End");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("analysis-mobile-en.png"), fullPage: true });
});
