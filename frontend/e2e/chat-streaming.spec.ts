import { API, ask, expect, test, upload } from "./fixtures";

const llmStats = async (request: import("@playwright/test").APIRequestContext) => (await request.get(`${API}/__e2e/llm`)).json();

test.beforeEach(async ({ page }) => {
  await page.goto("/app");
  await upload(page, "biology.pdf");
});

test("streams a Markdown answer with telemetry", async ({ page }) => {
  await ask(page, "What is ATP?");
  await expect(page.getByRole("status", { name: "Assistant is thinking" })).toBeVisible();
  await expect(page.locator(".md-streaming")).toBeVisible(); // caret while tokens arrive

  const answer = page.locator(".prose").last();
  await expect(answer.getByRole("cell", { name: "Krebs cycle" })).toBeVisible();
  await expect(page.locator(".md-streaming")).toHaveCount(0);
  await expect(answer.locator("strong", { hasText: "ATP" })).toBeVisible();
  await expect(page.locator(".not-prose").getByText("python", { exact: true })).toBeVisible();
  await expect(page.locator(".hljs-keyword").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy code" })).toBeVisible();

  await page.getByRole("button", { name: /System telemetry/ }).click();
  await expect(page.getByText("TTFT · server")).toBeVisible();
  await expect(page.getByText("Input tokens")).toBeVisible();
  await page.getByRole("button", { name: /Retrieved context/ }).click();
  await expect(page.getByText(/d=\d+\.\d{3}/).first()).toBeVisible();
  await page.getByRole("button", { name: /^Prompt/ }).click();
  await expect(page.getByText("Question: What is ATP?")).toBeVisible();
});

test("Esc stops generation on the server and keeps the partial reply", async ({ page, request }) => {
  const before = await llmStats(request);
  await ask(page, "Explain respiration");
  await expect(page.locator(".md-streaming")).toContainText("energy currency");
  await page.keyboard.press("Escape");

  await expect(page.getByText("Response stopped")).toBeVisible();
  await expect(page.getByText("Partial response")).toBeVisible();
  await expect.poll(async () => (await llmStats(request)).closed).toBe(before.closed + 1);
  expect((await llmStats(request)).completed).toBe(before.completed);
});

test("mid-stream failures surface inline", async ({ page }) => {
  await ask(page, "please fail");
  await expect(page.getByRole("alert")).toContainText("Answer generation failed");
});

test("a saved conversation restores its telemetry", async ({ page }) => {
  await ask(page, "What is ATP?");
  await expect(page.getByRole("cell", { name: "Krebs cycle" })).toBeVisible();
  await page.getByRole("button", { name: /History/ }).click();
  await page.getByRole("button", { name: /messages ·/ }).first().click();
  await page.getByRole("button", { name: /System telemetry/ }).first().click();
  await page.getByRole("button", { name: /^Prompt/ }).first().click();
  await expect(page.getByText("aren't stored with saved conversations")).toBeVisible();
});

test("summary streams Markdown and the quiz reports structured output", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "Summary" }).click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByLabel("Generating summary")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Key Takeaways" })).toBeVisible();
  await expect(page.getByRole("button", { name: /System telemetry/ })).toBeVisible();

  await page.getByRole("navigation").getByRole("button", { name: "Quiz" }).click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("What does the mitochondrion produce?")).toBeVisible();
  await page.getByRole("button", { name: /System telemetry/ }).click();
  await expect(page.getByText("Quiz · function_calling · valid · 2 items")).toBeVisible();

  // Keyboard answering: B selects, Enter submits, Enter advances
  await page.keyboard.press("b");
  await expect(page.locator("#option-B")).toHaveAttribute("data-state", "checked");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Explanation")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Where does photosynthesis occur?")).toBeVisible();
});
