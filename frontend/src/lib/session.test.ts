import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

// session.ts caches the id at module level, so load a fresh copy per test
const loadSession = async () => {
  vi.resetModules();
  return import("./session");
};

beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("getSessionId", () => {
  it("generates a backend-valid id once and persists it", async () => {
    const { getSessionId } = await loadSession();
    const id = getSessionId();

    expect(id).toMatch(/^[A-Za-z0-9-]{16,64}$/); // mirrors SESSION_ID_PATTERN in backend/app/sessions.py
    expect(getSessionId()).toBe(id);
    expect(localStorage.getItem("learnmate-session-id")).toBe(id);

    const reloaded = await loadSession(); // a page reload
    expect(reloaded.getSessionId()).toBe(id);
  });

  it("still works when storage is blocked", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => undefined,
    });
    const { getSessionId } = await loadSession();
    const id = getSessionId();
    expect(id).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    expect(getSessionId()).toBe(id);
  });
});

describe("fetchChecked", () => {
  it("sends the session id on every request", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const { getSessionId } = await loadSession();
    const { requestJson } = await import("./http");

    await requestJson("/current-session-documents");

    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers["X-Session-Id"]).toBe(getSessionId());
  });
});
