import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite: the real FastAPI app (scripted LLM, offline embeddings; see
 * backend/tests/e2e_server.py) behind a production build served with render.yaml's headers.
 *
 *   npm run e2e          # locally uses your installed Chrome
 *   CI=1 npm run e2e     # CI uses Playwright's Chromium (npx playwright install chromium)
 */
const API_PORT = 8766; // must be an origin the backend's CORS allows in development
const WEB_PORT = 8081;
const API = `http://127.0.0.1:${API_PORT}`;
const python = process.env.E2E_PYTHON ?? "../backend/venv/bin/python";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // one shared backend; specs isolate themselves with fresh sessions
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: [
    {
      command: `${python} ../backend/tests/e2e_server.py`,
      url: `${API}/health`,
      env: { E2E_BACKEND_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite build --outDir dist-e2e --emptyOutDir && node e2e/serve.mjs dist-e2e ${WEB_PORT} ${API}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_URL: API },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
