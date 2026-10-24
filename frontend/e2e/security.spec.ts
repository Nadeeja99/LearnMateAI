import { API, ask, expect, test, upload } from "./fixtures";

test("the production CSP allows every feature and blocks injected scripts", async ({ page, request }) => {
  const violations = () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });

  const landing = await page.goto("/");
  expect(landing?.headers()["content-security-policy"]).toContain("script-src 'self';"); // no inline allowances
  await expect(page.getByText("Transform your learning with AI")).toBeVisible();
  // Theme still applies under the strict policy (next-themes sets it from React)
  await expect(page.locator("html")).toHaveClass(/light|dark/);
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Inter Variable"'))).toBe(true);

  await page.goto("/app");
  await upload(page, "biology.pdf");
  await ask(page, "What is ATP?");
  await expect(page.locator(".hljs-keyword").first()).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "Summary" }).click();
  await page.getByRole("button", { name: "Generate summary" }).click();
  await expect(page.getByRole("heading", { name: "Key Takeaways" })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "Voice Chat" }).click();
  await page.getByRole("button", { name: "Connect to voice agent" }).click();
  await expect(page.getByText(/voice learning assistant/i)).toBeVisible();

  const fontRequests = await page.evaluate(() => performance.getEntriesByType("resource").filter((r) => /fonts\.(googleapis|gstatic)/.test(r.name)).length);
  expect(fontRequests).toBe(0);
  expect(await violations()).toEqual([]);

  // Negative control: what an XSS payload would try
  const result = await page.evaluate(async () => {
    const script = document.createElement("script");
    script.textContent = 'window.__stolen = localStorage.getItem("learnmate-session-id")';
    document.body.appendChild(script);
    new Image().src = "https://evil.example/collect";
    await new Promise((r) => setTimeout(r, 300));
    return (window as unknown as { __stolen?: string }).__stolen;
  });
  expect(result).toBeUndefined();
  expect(await violations()).toEqual(expect.arrayContaining([expect.stringMatching(/^script-src/), expect.stringMatching(/^img-src https:\/\/evil\.example/)]));

  // The API refuses requests without a session and sends security headers
  const anonymous = await request.get(`${API}/current-session-documents`);
  expect(anonymous.status()).toBe(400);
  expect(anonymous.headers()["x-content-type-options"]).toBe("nosniff");
  expect(anonymous.headers()["x-request-id"]).toBeTruthy();
});

test("icons are real images", async ({ request }) => {
  const ico = await (await request.get("/favicon.ico")).body();
  const touch = await (await request.get("/apple-touch-icon.png")).body();
  expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
  expect(touch.subarray(1, 4).toString()).toBe("PNG");
});
