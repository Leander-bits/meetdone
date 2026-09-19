import { expect, test } from "@playwright/test";

test("short errors stay bilingual and custom text is never replaced", async ({ page }) => {
  await page.goto("/meetings/demo-launch");
  const transcript = page.getByRole("textbox", { name: "会议记录", exact: true });
  await transcript.fill("");
  await page.getByRole("button", { name: "分析会议", exact: true }).click();
  await expect(page.getByRole("region", { name: "会议记录" }).getByRole("alert")).toContainText(
    "请输入会议记录",
  );
  await transcript.fill("简短记录");
  await page.getByRole("button", { name: "分析会议", exact: true }).click();
  await expect(page.getByRole("region", { name: "会议记录" }).getByRole("alert")).toContainText(
    "会议内容太短，无法分析",
  );
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("region", { name: "Transcript" }).getByRole("alert")).toContainText(
    "The transcript is too short to analyze",
  );
  await expect(page.getByRole("textbox", { name: "Transcript", exact: true })).toHaveValue(
    "简短记录",
  );
  await expect(page.locator("#meeting-status").getByRole("status")).toHaveText("Not analyzed");
  await expect(page.getByRole("button", { name: "End Meeting", exact: true })).toHaveCount(0);
});

test("mobile demo ends with a compact summary and readable English layout", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/meetings/demo-launch");
  await page.locator("summary").filter({ hasText: "加载演示场景" }).click();
  await page.getByRole("button", { name: /场景 B/ }).click();
  await page.getByRole("button", { name: "使用演示分析", exact: true }).click();
  await page.getByRole("button", { name: "准备结束会议", exact: true }).click();
  await expect(page.locator("#meeting-status").getByRole("status")).toContainText("可以结束");
  await page.getByRole("button", { name: "结束会议", exact: true }).click();
  await expect(page.getByRole("heading", { name: "会议摘要" })).toBeVisible();
  await expect(page.getByText("已结束", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "已完成目标" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("summary-mobile-zh.png"), fullPage: true });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Open Issues" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("summary-mobile-en.png"), fullPage: true });
  await page.getByRole("button", { name: "Reset Demo" }).click();
  await expect(page.locator("#meeting-status").getByRole("status")).toContainText("Blocked");
  await page.getByRole("button", { name: "Prepare to End Meeting", exact: true }).click();
  await page.getByRole("button", { name: "End with Exception", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Waiting for written approval tomorrow.");
  await page.screenshot({ path: testInfo.outputPath("exception-mobile-en.png"), fullPage: true });
  await dialog.getByRole("button", { name: "End with Exception", exact: true }).click();
  await expect(page.getByText("Ended with Exceptions", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting for written approval tomorrow.", { exact: true })).toBeVisible();
});

test("single form supports all templates, preserves a custom title, and cancels cleanly", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "创建会议", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "会议名称" }).fill("我的客户会议");
  await dialog.getByRole("combobox", { name: "模板", exact: true }).selectOption("customer");
  await expect(dialog.getByRole("textbox", { name: "会议名称" })).toHaveValue("我的客户会议");
  await expect(dialog.getByRole("textbox", { name: "会议目标 1", exact: true })).not.toBeEmpty();
  await dialog.getByRole("button", { name: "创建会议", exact: true }).click();
  await expect(page.getByRole("heading", { name: "我的客户会议" })).toBeVisible();
  await page.getByRole("button", { name: "编辑要求", exact: true }).click();
  await page.getByRole("textbox", { name: "会议目标 1", exact: true }).fill("未保存的内容");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByText("未保存的内容", { exact: true })).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("meetdone.workspace.v1")!).meetings.find(
      (m: { title: string }) => m.title === "我的客户会议",
    ),
  );
  expect(saved.templateId).toBe("customer");
  expect(saved.requirements.items.some((r: { label: string }) => r.label === "未保存的内容")).toBe(
    false,
  );
});
