/** JSON request helper: checks response.ok, surfaces FastAPI `detail`, and supports AbortSignal. */
import { getSessionId } from "@/lib/session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";

/** Human-readable message for an unknown error value. */
export const errorText = (error: unknown, fallback = "Something went wrong. Please try again."): string =>
  error instanceof Error && error.message ? error.message : fallback;

export type RequestOptions = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

/**
 * fetch() that sends the session header and throws ApiError for network failures and
 * non-2xx responses (AbortError passes through).
 */
export async function fetchChecked(url: string, { json, headers, body, ...init }: RequestOptions = {}): Promise<Response> {
  const sessionHeaders: Record<string, string> = { "X-Session-Id": getSessionId() };
  if (json !== undefined) sessionHeaders["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...sessionHeaders, ...(headers as Record<string, string> | undefined) },
      body: json === undefined ? body : JSON.stringify(json),
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError("Can't reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new ApiError(await readErrorDetail(response), response.status);
  }
  return response;
}

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetchChecked(url, options);
  return (await response.json()) as T;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // Non-JSON error body
  }
  return `Request failed (${response.status})`;
}
