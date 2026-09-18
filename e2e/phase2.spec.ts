import { expect, test } from "@playwright/test";
import { requirementKey } from "../lib/models";

test("Chinese is default, language persists, and built-in templates follow the UI", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "体验演示会议" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.screenshot({ path: testInfo.outputPath("home-zh.png"), fullPage: true });
  await page.getByRole("link", { name: "体验演示会议" }).click();
  await page.getByRole("button", { name: "准备结束会议", exact: true }).click();
  await expect(page.getByRole("heading", { name: "会议暂时不能结束" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("gaps-zh.png"), fullPage: true });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Meeting cannot end yet" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Prepare to End Meeting", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.evaluate(() => localStorage.getItem("meetdone.language"))).toBe("en");
});

test("dynamic lists keep one entry, persist new IDs, and do not translate custom content", async ({
  page,
}) => {
  await page.goto("/meetings/demo-launch");
  await page.getByRole("button", { name: "会议要求", exact: true }).click();
  await expect(page.getByRole("button", { name: "移除: 会议目标 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "添加一项: 会议目标", exact: true }).click();
  await page
    .getByRole("textbox", { name: "会议目标 2", exact: true })
    .fill("我的中文目标，不要翻译");
  await page.getByRole("button", { name: "保存要求", exact: true }).click();
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("meetdone.workspace.v1")!).meetings[0],
  );
  const added = stored.requirements.items.find(
    (r: { label: string }) => r.label === "我的中文目标，不要翻译",
  );
  expect(added.id).toBeTruthy();
  expect(stored.analysis).toBeNull();
  expect(stored.completionCheck).toBeNull();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Goals 2", exact: true })).toHaveValue(
    "我的中文目标，不要翻译",
  );
  await expect(page.getByRole("textbox", { name: "Goals 1", exact: true })).toHaveValue(
    "Evaluate Atlas launch readiness across Product, Engineering, and Sales",
  );
  await page.reload();
  await page.getByRole("button", { name: "Requirements", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Goals 2", exact: true })).toHaveValue(
    "我的中文目标，不要翻译",
  );
  await page.getByRole("button", { name: "Remove: Goals 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove: Goals 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Save requirements", exact: true }).click();
  const updated = await page.evaluate(
    () => JSON.parse(localStorage.getItem("meetdone.workspace.v1")!).meetings[0],
  );
  expect(updated.requirements.items.some((r: { id: string }) => r.id === added.id)).toBe(false);
});

test("custom transcript AI analysis updates deterministic readiness and preserves evidence", async ({
  page,
}) => {
  await page.goto("/meetings/demo-launch");
  await page.getByRole("button", { name: "会议文本", exact: true }).click();
  const transcript =
    "Maya · Product: We discussed Go / No-Go, but the final decision has not been made. Jordan was invited but has not expressed an opinion.";
  await page.getByLabel("会议文本内容", { exact: true }).fill(transcript);
  let calls = 0;
  await page.route("**/api/analyze-meeting", async (route) => {
    calls += 1;
    const input = route.request().postDataJSON();
    const decision = input.requirements.items.find((r: { id: string }) => r.id === "l-decision");
    await new Promise((resolve) => setTimeout(resolve, 150));
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
              requirementId: decision.id,
              requirementKey: requirementKey(decision, input.requirements.items),
              status: "discussed",
              classification: "discussed_not_decided",
              outcome: null,
              detail: "No final decision has been made.",
              evidenceIds: ["e1"],
            },
          ],
          actionItems: [],
          unresolvedIssues: [],
          evidence: [
            {
              id: "e1",
              speaker: "Maya · Product",
              quote: "We discussed Go / No-Go, but the final decision has not been made.",
              segmentId: "line-1",
              transcriptRevision: input.transcript.revision,
            },
          ],
        },
      },
    });
  });
  await page.getByRole("button", { name: "分析会议", exact: true }).click();
  await expect(page.getByRole("button", { name: "正在分析", exact: true })).toBeDisabled();
  await expect(
    page.getByText("分析完成，覆盖情况和就绪状态已更新。", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "决策", exact: true }).click();
  await expect(page.getByText("已讨论，未决策", { exact: true })).toBeVisible();
  await page.getByText(/查看证据/).click();
  await expect(page.getByRole("blockquote")).toContainText(
    "We discussed Go / No-Go, but the final decision has not been made.",
  );
  await page.reload();
  await expect(page.getByText("AI 分析模式", { exact: true })).toBeVisible();
  await expect(page.getByText("AI 提取事实 · 规则判断就绪状态", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("button", { name: "Transcript", exact: true }).click();
  await expect(page.getByLabel("Transcript text", { exact: true })).toHaveValue(transcript);
  await page.getByLabel("Transcript text", { exact: true }).fill(transcript + " More discussion.");
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("meetdone.workspace.v1")!).meetings[0],
  );
  expect(stored.analysis).toBeNull();
  expect(stored.completionCheck).toBeNull();
});

test("AI failure preserves custom text and demo fallback works without a key", async ({ page }) => {
  await page.goto("/meetings/demo-launch");
  await page.getByRole("button", { name: "会议文本", exact: true }).click();
  const transcript =
    "主持人：我们已经讨论了项目发布的时间安排，但是尚未做出最终决定，也没有指定后续行动的负责人。";
  await page.getByLabel("会议文本内容").fill(transcript);
  await page.route("**/api/analyze-meeting", (route) =>
    route.fulfill({ status: 503, json: { error: "MISSING_API_KEY" } }),
  );
  await page.getByRole("button", { name: "分析会议", exact: true }).click();
  await expect(page.getByText("AI 分析失败", { exact: true })).toBeVisible();
  await expect(page.getByLabel("会议文本内容")).toHaveValue(transcript);
  await page.getByRole("button", { name: "使用演示分析", exact: true }).click();
  await expect(page.getByLabel("会议文本内容")).toHaveValue(transcript);
  await page.getByRole("button", { name: /场景 B/ }).click();
  await page.getByRole("button", { name: "使用演示分析", exact: true }).click();
  await page.getByRole("button", { name: "准备结束会议", exact: true }).click();
  await expect(page.getByRole("heading", { name: "会议可以结束" })).toBeVisible();
});

test("Chinese mobile UI and create flow fit the viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "创建会议", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /项目复盘/ })
    .click();
  await expect(page.getByLabel("会议标题")).toHaveValue("第 24 次迭代复盘");
  await page.getByRole("button", { name: "定义要求", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "会议目标 1", exact: true })).toHaveValue(
    "找出促进和阻碍交付的因素",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("create-mobile-zh.png"), fullPage: true });
});
