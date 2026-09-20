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
export async function demoComplete(page: Page) {
  await page.getByText("Load Demo Scenario", { exact: true }).click();
  await page.getByRole("button", { name: /Scenario B/ }).click();
  await page.getByRole("button", { name: "Use Demo Analysis", exact: true }).click();
}
