import { API, ask, expect, sessionId, test, upload } from "./fixtures";

test("each browser is an isolated session, and documents survive a restart", async ({ browser, request }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();
  await alice.goto("/app");
  await bob.goto("/app");

  const [aliceId, bobId] = [await sessionId(alice), await sessionId(bob)];
  expect(aliceId).toBeTruthy();
  expect(aliceId).not.toBe(bobId);

  await upload(alice, "biology.pdf");
  await ask(alice, "What is ATP?");
  await expect(alice.getByText("Answer grounded in: biology.pdf.")).toBeVisible();

  await bob.reload();
  await expect(bob.getByText("0 documents in session")).toBeVisible();
  await expect(bob.getByText("biology.pdf")).toHaveCount(0);
  await upload(bob, "history.pdf");
  await ask(bob, "Summarize");
  await expect(bob.getByText("Answer grounded in: history.pdf.")).toBeVisible(); // never Alice's document

  await bob.getByRole("button", { name: /History/ }).click();
  await expect(bob.getByRole("button", { name: /messages ·/ })).toHaveCount(1);

  // Rebuild every service from disk, as a process restart would
  await request.post(`${API}/__e2e/restart`);
  await alice.reload();
  await expect(alice.getByRole("complementary").getByText("biology.pdf")).toBeVisible();
  await ask(alice, "Still there?");
  await expect(alice.getByText("Answer grounded in: biology.pdf.").last()).toBeVisible();
});
