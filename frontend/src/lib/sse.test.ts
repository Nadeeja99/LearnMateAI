import { describe, expect, it } from "vitest";
import { parseSSE } from "./sse";

/** A byte stream that delivers the given string chunks one read at a time. */
const streamOf = (...chunks: string[]) => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
};

const collect = async (stream: ReadableStream<Uint8Array>) => {
  const messages = [];
  for await (const message of parseSSE(stream)) messages.push(message);
  return messages;
};

describe("parseSSE", () => {
  it("parses named events", async () => {
    expect(await collect(streamOf('event: token\ndata: {"content":"Hi"}\n\n'))).toEqual([{ event: "token", data: '{"content":"Hi"}' }]);
  });

  it("reassembles frames split across chunks, including mid-character", async () => {
    const frame = 'event: token\ndata: {"content":"héllo"}\n\n';
    const bytes = new TextEncoder().encode(frame);
    const split = bytes.indexOf(0xc3) + 1; // inside the 2-byte "é"
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    });
    expect(await collect(stream)).toEqual([{ event: "token", data: '{"content":"héllo"}' }]);
  });

  it("handles CRLF, comments, multi-line data and default event names", async () => {
    const messages = await collect(streamOf(": keep-alive\r\n\r\n", "data: line one\r\ndata: line two\r\n\r\n", "event: done\ndata: {}\n\n"));
    expect(messages).toEqual([
      { event: "message", data: "line one\nline two" },
      { event: "done", data: "{}" },
    ]);
  });

  it("flushes a final frame without a trailing blank line", async () => {
    expect(await collect(streamOf("event: done\ndata: {}"))).toEqual([{ event: "done", data: "{}" }]);
  });
});
