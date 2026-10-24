/** Minimal Server-Sent Events parser for fetch() response bodies (EventSource can't POST). */

export interface SSEMessage {
  event: string;
  data: string;
}

/** Yields one message per blank-line-terminated frame. Handles frames split across chunks and CRLF. */
export async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEMessage> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const message = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (message) yield message;
      }
    }
    const trailing = parseFrame(buffer + decoder.decode());
    if (trailing) yield trailing;
  } finally {
    // Cancels the underlying request when the consumer stops early
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function parseFrame(frame: string): SSEMessage | null {
  let event = "message";
  const data: string[] = [];

  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue; // blank or comment
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }

  return data.length ? { event, data: data.join("\n") } : null;
}
