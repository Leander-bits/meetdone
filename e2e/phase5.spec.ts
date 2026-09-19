import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const demoName = "Bosch CE T4 Station Data Editor 上线评审";
async function storedMeetings(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("meetdone.workspace.v1") ?? '{"meetings":[]}').meetings,
  );
}
test("meeting deletion names the meeting, cancels safely and survives an empty reload", async ({
  page,
}) => {
  await page.goto("/meetings/demo-launch");
  await page.getByRole("button", { name: "准备结束会议", exact: true }).click();
  await page.getByRole("link", { name: "返回", exact: true }).click();
  const before = await storedMeetings(page);
  await page.getByRole("button", { name: `删除会议: ${demoName}`, exact: true }).click();
  await expect(page.getByRole("dialog").getByText(demoName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(await storedMeetings(page)).toEqual(before);
  await page.getByRole("button", { name: `删除会议: ${demoName}`, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByText("暂无会议", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("暂无会议", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "创建会议", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "模板", exact: true }).locator("option"),
  ).toHaveCount(3);
});

test("custom templates start empty, persist, edit and delete without changing existing meetings", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "创建会议", exact: true }).click();
  await page.getByRole("button", { name: "创建新模板", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "会议名称", exact: true })).toHaveValue("");
  const kinds = ["会议目标", "必要结论", "议题", "必要发言", "行动产出"];
  for (const kind of kinds) {
    await expect(page.getByRole("textbox", { name: `${kind} 1`, exact: true })).toHaveValue("");
    await expect(page.getByRole("button", { name: `移除: ${kind} 1`, exact: true })).toBeDisabled();
    await page.getByRole("textbox", { name: `${kind} 1`, exact: true }).fill(`我的${kind}`);
  }
  await page.getByRole("textbox", { name: "模板名称", exact: true }).fill("生产评审自定义模板");
  await page.getByRole("textbox", { name: "会议名称", exact: true }).fill("本周生产评审");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByText("模板已保存", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "创建会议", exact: true }).click();
  await expect(page.getByRole("heading", { name: "本周生产评审" })).toBeVisible();
  await page.getByRole("link", { name: "返回", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "创建会议", exact: true }).click();
  await page
    .getByRole("combobox", { name: "模板", exact: true })
    .selectOption({ label: "生产评审自定义模板" });
  await expect(page.getByRole("textbox", { name: "会议目标 1", exact: true })).toHaveValue(
    "我的会议目标",
  );
  await page.getByRole("textbox", { name: "会议目标 1", exact: true }).fill("修改后的目标");
  await page.getByRole("button", { name: "模板选项", exact: true }).click();
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("custom-template.png"), fullPage: true });
  await page.getByRole("button", { name: "模板选项", exact: true }).click();
  await page.getByRole("button", { name: "删除自定义模板", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "删除此模板？" });
  await expect(confirmation.getByText("生产评审自定义模板", { exact: true })).toBeVisible();
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "删除自定义模板", exact: true }).click();
  await confirmation.getByRole("button", { name: "删除", exact: true }).click();
  await page
    .getByRole("dialog", { name: "创建会议", exact: true })
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await page.reload();
  await page.getByRole("link").filter({ hasText: "本周生产评审" }).click();
  await expect(page.getByText("我的会议目标", { exact: true })).toBeVisible();
  const saved = await storedMeetings(page);
  expect(
    saved.find((m: { title: string }) => m.title === "本周生产评审").requirements.items[0].label,
  ).toBe("我的会议目标");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("meetdone.templates.v1")!).templates),
  ).toEqual([]);
});

test("built-in templates only offer saving a copy, never deletion", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "创建会议", exact: true }).click();
  for (const id of ["launch", "retro", "customer"]) {
    await page.getByRole("combobox", { name: "模板", exact: true }).selectOption(id);
    await page.getByRole("button", { name: "另存为模板", exact: true }).click();
    await expect(page.getByRole("button", { name: "删除自定义模板", exact: true })).toHaveCount(0);
  }
  await page.getByRole("textbox", { name: "模板名称", exact: true }).fill("客户评审副本");
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "模板", exact: true }).locator("option"),
  ).toHaveCount(4);
});

test("TXT import preserves UTF-8, filename and edits while clearing stale analysis", async ({
  page,
}) => {
  await page.goto("/meetings/demo-launch");
  await page.getByRole("button", { name: "准备结束会议", exact: true }).click();
  const text = "Devi: 今天确认 CE T4 的上线安排。\nMax: 工程测试通过，等待业务负责人确认。";
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "上线讨论.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(text, "utf8"),
    });
  const editor = page.getByRole("textbox", { name: "会议记录", exact: true });
  await expect(editor).toHaveValue(text);
  await expect(page.getByText("上线讨论.txt", { exact: true })).toBeVisible();
  const saved = (await storedMeetings(page))[0];
  expect(saved.analysis).toBeNull();
  expect(saved.completionCheck).toBeNull();
  await editor.fill(text + "\nSun: 我补充一下。");
  await page.reload();
  await expect(editor).toHaveValue(text + "\nSun: 我补充一下。");
  await expect(page.getByText("上线讨论.txt", { exact: true })).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from([0xff, 0xfe]) });
  await expect(page.getByText("文件需使用 UTF-8 编码", { exact: true })).toBeVisible();
  await expect(editor).toHaveValue(text + "\nSun: 我补充一下。");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "bad.pdf", mimeType: "application/pdf", buffer: Buffer.from("PDF") });
  await expect(page.getByText("请选择 .txt 文本文件", { exact: true })).toBeVisible();
});

test("50,000-character import is accepted; over-limit imports reject and pasted text is never truncated", async ({
  page,
}) => {
  await page.goto("/meetings/demo-launch");
  const editor = page.getByRole("textbox", { name: "会议记录", exact: true });
  const text = "中".repeat(50_000);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "large.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(editor).toHaveValue(text);
  await expect(page.getByText("50,000 / 50,000", { exact: true })).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "over.txt", mimeType: "text/plain", buffer: Buffer.from(text + "文") });
  await expect(page.getByText("会议记录不能超过 50,000 个字符", { exact: true })).toBeVisible();
  await expect(editor).toHaveValue(text);
  await editor.fill(text + "文");
  await expect(editor).toHaveValue(text + "文");
  await expect(page.getByRole("button", { name: "分析会议", exact: true })).toBeDisabled();
});

test("new Chinese launch demo resolves four blockers through additional discussion", async ({
  page,
}, testInfo) => {
  await page.goto("/meetings/demo-launch");
  await expect(page.getByRole("heading", { name: demoName, exact: true })).toBeVisible();
  const editor = page.getByRole("textbox", { name: "会议记录", exact: true });
  const before = await editor.inputValue();
  await page.getByRole("button", { name: "准备结束会议", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.locator("summary").filter({ hasText: "加载演示场景" }).click();
  await page.getByRole("button", { name: /场景 B/ }).click();
  expect((await editor.inputValue()).startsWith(before)).toBe(true);
  await page.getByRole("button", { name: "使用演示分析", exact: true }).click();
  await page.getByRole("button", { name: "准备结束会议", exact: true }).click();
  await expect(page.locator("#meeting-status").getByRole("status")).toContainText("可以结束");
  await page.getByRole("button", { name: "结束会议", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Sun", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Max", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("bosch-summary.png"), fullPage: true });
});
