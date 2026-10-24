import { afterEach, describe, expect, it, vi } from "vitest";
import { pickRecordingMimeType } from "./audio";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Minimal XMLHttpRequest double: records the request and lets the test drive progress/completion. */
class FakeXHR {
  static last: FakeXHR;
  headers: Record<string, string> = {};
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  status = 0;
  responseText = "";
  responseType = "";
  method = "";
  url = "";
  body: unknown;
  constructor() {
    FakeXHR.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.onabort?.();
  }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

const loadHttp = async () => {
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  vi.stubGlobal("localStorage", { getItem: () => "aaaaaaaa-1111-2222-3333-444444444444", setItem: () => undefined });
  return import("./http");
};

describe("uploadWithProgress", () => {
  it("reports progress, sends the session header and resolves with JSON", async () => {
    const { uploadWithProgress } = await loadHttp();
    const progress: number[] = [];
    const result = uploadWithProgress<{ ok: boolean }>("/upload", new FormData(), { onProgress: (f) => progress.push(f) });

    const xhr = FakeXHR.last;
    expect(xhr.method).toBe("POST");
    expect(xhr.headers["X-Session-Id"]).toBe("aaaaaaaa-1111-2222-3333-444444444444");
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 200, total: 200 });
    xhr.respond(200, { ok: true });

    await expect(result).resolves.toEqual({ ok: true });
    expect(progress).toEqual([0.25, 1]);
  });

  it("rejects with the server's detail", async () => {
    const { uploadWithProgress } = await loadHttp();
    const result = uploadWithProgress("/upload", new FormData());
    FakeXHR.last.respond(415, { detail: "This file isn't a valid PDF." });
    await expect(result).rejects.toMatchObject({ message: "This file isn't a valid PDF.", status: 415 });
  });

  it("aborts via AbortSignal", async () => {
    const { uploadWithProgress, isAbortError } = await loadHttp();
    const controller = new AbortController();
    const result = uploadWithProgress("/upload", new FormData(), { signal: controller.signal });
    controller.abort();
    expect(isAbortError(await result.catch((e) => e))).toBe(true);
  });
});

describe("pickRecordingMimeType", () => {
  it("prefers WebM/Opus where supported (Chrome, Firefox)", () => {
    expect(pickRecordingMimeType(() => true)).toBe("audio/webm;codecs=opus");
  });

  it("falls back to MP4 on Safari", () => {
    expect(pickRecordingMimeType((type) => type === "audio/mp4")).toBe("audio/mp4");
  });

  it("returns undefined when nothing matches so the browser picks a default", () => {
    expect(pickRecordingMimeType(() => false)).toBeUndefined();
  });
});

describe("resetSessionId", () => {
  it("issues and persists a new, different id", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const { getSessionId, resetSessionId } = await import("./session");

    const before = getSessionId();
    const after = resetSessionId();
    expect(after).not.toBe(before);
    expect(getSessionId()).toBe(after);
    expect(store.get("learnmate-session-id")).toBe(after);
  });
});

describe("loadServerConfig", () => {
  it("falls back to defaults when /config is unreachable, then retries", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(
      new Response(JSON.stringify({ max_upload_size: 1024, max_documents_per_session: 3 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => "aaaaaaaa-1111-2222-3333-444444444444", setItem: () => undefined });
    const { loadServerConfig, DEFAULT_SERVER_CONFIG } = await import("@/hooks/use-server-config");

    expect(await loadServerConfig()).toEqual(DEFAULT_SERVER_CONFIG);
    expect(await loadServerConfig()).toEqual({ max_upload_size: 1024, max_documents_per_session: 3 });
    expect(await loadServerConfig()).toEqual({ max_upload_size: 1024, max_documents_per_session: 3 }); // cached
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
