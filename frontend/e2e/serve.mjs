// Serves the production build with the exact response headers declared in render.yaml
// (CSP etc.), swapping the deployed backend origin for the local test backend, so the
// end-to-end suite exercises the security policy that actually ships.
//
//   node e2e/serve.mjs <distDir> <port> <apiOrigin>
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const [distArg = "dist", portArg = "8081", apiOrigin = "http://127.0.0.1:8766"] = process.argv.slice(2);
const dist = resolve(distArg);
const repoRoot = resolve(fileURLToPath(import.meta.url), "../../..");

const blueprint = YAML.parse(await readFile(join(repoRoot, "render.yaml"), "utf8"));
const frontend = blueprint.services.find((service) => service.name === "learnmate-frontend");
const deployedApi = frontend.envVars.find((env) => env.key === "VITE_API_URL").value;
const apiWs = apiOrigin.replace(/^http/, "ws");
const headers = Object.fromEntries(
  frontend.headers.map(({ name, value }) => [
    name,
    value.replaceAll(deployedApi.replace(/^https/, "wss"), apiWs).replaceAll(deployedApi, apiOrigin),
  ]),
);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".json": "application/json",
};

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(dist, path);
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
  } catch {
    file = join(dist, "index.html"); // SPA rewrite, like render.yaml's /* -> /index.html
  }
  const body = await readFile(file);
  response.writeHead(200, { ...headers, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  response.end(body);
}).listen(Number(portArg), "127.0.0.1", () => console.log(`serving ${dist} on :${portArg} with render.yaml headers`));
