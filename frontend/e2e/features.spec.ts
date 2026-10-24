import { writeFileSync } from "node:fs";
import { API, ask, expect, sessionId, test, upload } from "./fixtures";

test("limits, real upload progress, feedback and the summary hand-off", async ({ page, request }, testInfo) => {
  // Records transient UI states that may exist only for a moment
  await page.addInitScript(() => {
    const seen = new Set<string>();
    (window as unknown as { __seen: Set<string> }).__seen = seen;
    new MutationObserver(() => {
      for (const m of document.body?.innerText.match(/Uploading… \d+%|Processing document…/g) ?? []) seen.add(m.replace(/\d+%/, "N%"));
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.goto("/app");
  await expect(page.getByText("up to 5MB")).toBeVisible(); // from GET /config (test backend: 5 MB)

  const slow = testInfo.outputPath("slow-notes.pdf");
  writeFileSync(slow, Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(3_900_000, "Mitochondria produce ATP. ")]));
  await page.locator("#file-upload").setInputFiles(slow);
  await expect(page.getByRole("complementary").getByText("slow-notes.pdf")).toBeVisible({ timeout: 20_000 });
  const seen = await page.evaluate(() => [...(window as unknown as { __seen: Set<string> }).__seen]);
  expect(seen).toEqual(expect.arrayContaining(["Uploading… N%", "Processing document…"]));

  await ask(page, "What is ATP?");
  await expect(page.getByRole("cell", { name: "Krebs cycle" })).toBeVisible();
  await page.getByRole("button", { name: "Helpful", exact: true }).click();
  await expect(page.getByRole("button", { name: "Helpful", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => (await (await request.get(`${API}/analytics/performance-metrics?metric_name=answer_feedback`)).json()).metrics.length)
    .toBeGreaterThan(0);

  await page.getByRole("navigation").getByRole("button", { name: "Summary" }).click();
  await page.getByRole("button", { name: "Generate summary" }).click();
  await page.getByRole("button", { name: "Chat about this summary" }).click();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(/key takeaways/);

  await page.getByRole("navigation").getByRole("button", { name: "Analytics" }).click();
  await page.getByRole("tab", { name: "Model performance" }).click();
  await expect(page.getByText("Median time to first token")).toBeVisible();
  await expect(page.getByText(/\d+ up · \d+ down/)).toBeVisible();
});

test("deleting asks first, and Clear my data wipes the session", async ({ page, request }) => {
  await page.goto("/app");
  await upload(page, "biology.pdf");
  const original = await sessionId(page);

  await page.getByRole("navigation").getByRole("button", { name: "My Documents" }).click();
  await expect(page.getByText(/PDF · 3 chunks/)).toBeVisible(); // real metadata, not "Uploaded today"
  await page.getByRole("button", { name: "Delete biology.pdf" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Delete document?");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "biology.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "Delete biology.pdf" }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("No documents yet")).toBeVisible();

  await upload(page, "history.pdf");
  await page.getByRole("button", { name: "Clear my data" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByText("0 documents in session")).toBeVisible();
  expect(await sessionId(page)).not.toBe(original);
  const old = await request.get(`${API}/current-session-documents`, { headers: { "X-Session-Id": original } });
  expect((await old.json()).documents).toEqual([]);
});
