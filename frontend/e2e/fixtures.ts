import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const API = "http://127.0.0.1:8766";
const FILES = path.join(path.dirname(fileURLToPath(import.meta.url)), "files");

/** Upload a fixture PDF through the sidebar file input. */
export async function upload(page: Page, name: string) {
  await page.locator("#file-upload").setInputFiles(path.join(FILES, name));
  await expect(page.getByRole("complementary").getByText(name)).toBeVisible({ timeout: 15_000 });
}

export async function ask(page: Page, question: string) {
  const composer = page.getByRole("textbox", { name: "Message" });
  await composer.fill(question);
  await composer.press("Enter");
}

export async function sessionId(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem("learnmate-session-id") ?? "");
}

export { test, expect };
