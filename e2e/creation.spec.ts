import { test, expect } from "@playwright/test";
import { details, english, configuration, saved } from "./helpers";

test("Chinese home has two modules, three demos, language persistence and dismissible help", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: "已有会议" })).toBeVisible();
  await expect(page.locator('a[href^="/meetings/"]')).toHaveCount(3);
  await page.getByRole("button", { name: "关于 MeetDone" }).click();
  await expect(page.locator("#create-help")).toBeVisible();
  await page.mouse.click(20, 100);
  await expect(page.locator("#create-help")).not.toBeVisible();
  await page.screenshot({ path: info.outputPath("home-zh.png"), fullPage: true });
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Existing Meetings" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("meetdone.language"))).toBe("en");
});
test("deletion confirms the named meeting; cancel preserves all data", async ({ page }) => {
  await english(page);
  const before = await saved(page);
  await page
    .getByRole("button", { name: "Delete meeting: Mobile feature launch review", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Mobile feature launch review");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await saved(page)).toEqual(before);
  await page
    .getByRole("button", { name: "Delete meeting: Mobile feature launch review", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator('a[href^="/meetings/"]')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('a[href^="/meetings/"]')).toHaveCount(2);
  for (const name of ["Two-week sprint retrospective", "Customer onboarding progress"]) {
    await page.getByRole("button", { name: `Delete meeting: ${name}`, exact: true }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
  }
  await page.reload();
  await expect(page.getByText("No meetings yet.")).toBeVisible();
});
test("Page 1 validates date, time, email and editable display name; close confirms dirty data", async ({
  page,
}) => {
  await english(page);
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await page.getByLabel("Meeting name", { exact: true }).fill("Keep this draft");
  await page.getByRole("button", { name: "Back to Home", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Meeting name")).toHaveValue("Keep this draft");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await details(page);
  await page.getByLabel("Display name 1", { exact: true }).fill("Jiaheng");
  await page.getByLabel("Email 1", { exact: true }).fill("new@example.com");
  await expect(page.getByLabel("Display name 1", { exact: true })).toHaveValue("Jiaheng");
  await page.getByLabel("End time", { exact: true }).fill("08:30");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await page.getByLabel("End time", { exact: true }).fill("09:30");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
});
test("template selection, protected built-ins and dynamic goals persist with meeting metadata", async ({
  page,
}) => {
  await english(page);
  await details(page, "我的会议，不要翻译");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save as Template", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Delete Custom Template/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Product Launch Decision", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Product Launch Decision", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Add goal", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Remove goal 1", exact: true }).first(),
  ).toBeDisabled();
  await page.getByLabel("Goal 2", { exact: true }).fill("我的新目标");
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "我的会议，不要翻译" })).toBeVisible();
  const m = (await saved(page))[0];
  expect(m.date).toBe("2026-09-22");
  expect(m.timezone).toBe("Europe/Berlin");
  expect(m.startTime).toBe("09:00");
  expect(m.endTime).toBe("09:30");
  expect(m.participants[0].name).toBe("zhaojiaheng");
  expect(m.goals).toHaveLength(2);
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.getByRole("heading", { name: "我的会议，不要翻译" })).toBeVisible();
  await expect(page.getByText("我的新目标", { exact: true })).toBeVisible();
});
test("blank custom template can be saved, reused, edited and deleted independently", async ({
  page,
}) => {
  await english(page);
  await configuration(page, "Create New Template");
  await expect(page.getByLabel("Goal 1", { exact: true })).toHaveValue("");
  await page.getByLabel("Goal 1", { exact: true }).fill("Agree on one outcome");
  await page.getByRole("button", { name: "Time Sequence", exact: true }).click();
  await page.getByRole("button", { name: "Save as Template", exact: true }).click();
  await page.getByLabel("Template name", { exact: true }).fill("Reusable review");
  await page.getByRole("button", { name: "Save Template", exact: true }).click();
  await expect(page.getByText("Template saved.")).toBeVisible();
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  const meetingId = (await saved(page))[0].id;
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.reload();
  await configuration(page, "Reusable review");
  await expect(page.getByLabel("Goal 1", { exact: true })).toHaveValue("Agree on one outcome");
  await page.getByLabel("Goal 1", { exact: true }).fill("Edited outcome");
  await page.getByRole("button", { name: "Save as Template", exact: true }).click();
  await page.getByRole("button", { name: "Save Template", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Custom Template: Reusable review", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reusable review", exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Custom Template: Reusable review", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reusable review", exact: true })).toHaveCount(0);
  expect((await saved(page)).find((m: { id: string }) => m.id === meetingId).goals[0].label).toBe(
    "Agree on one outcome",
  );
});
