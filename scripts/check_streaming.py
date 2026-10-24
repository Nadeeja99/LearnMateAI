#!/usr/bin/env python3
"""
Post-deploy check: are answers really streamed end-to-end, or does a proxy buffer them?

Uploads a tiny generated PDF into a throwaway session, asks one question over /ask/stream,
timestamps every SSE event as it arrives, then deletes the session.

  backend/venv/bin/python scripts/check_streaming.py https://learnmate-backend-koe5.onrender.com

Note: against a real deployment this makes one small OpenAI call (embeddings + a short answer).
Exit code 0 = streaming works, 1 = responses look buffered, 2 = the request failed.
"""

import argparse
import json
import sys
import time
import uuid

import httpx


def make_pdf(text: str) -> bytes:
    """A minimal valid single-page PDF containing `text` (extractable by PyPDF2)."""
    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    content = f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def stream_timings(client: httpx.Client, base: str) -> dict:
    started = time.monotonic()
    token_times, done = [], None
    body = {"question": "In two sentences, what does this document say about photosynthesis and mitochondria?"}
    with client.stream("POST", f"{base}/ask/stream", json=body, timeout=120) as response:
        response.raise_for_status()
        event = None
        for line in response.iter_lines():
            if line.startswith("event:"):
                event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                now = time.monotonic() - started
                if event == "token":
                    token_times.append(now)
                elif event == "done":
                    done = now
                elif event == "error":
                    raise RuntimeError(json.loads(line[5:])["message"])
    if not token_times or done is None:
        raise RuntimeError("stream ended without tokens or a done event")
    return {"tokens": len(token_times), "token_times": token_times, "first_token_s": token_times[0], "last_token_s": token_times[-1], "done_s": done}


def verdict(t: dict) -> bool:
    """Streamed if tokens arrived in separate reads (visible gaps), not all in one buffered burst.

    A buffering proxy delivers the whole body at once, so every inter-token gap is ~0 ms;
    real streaming shows gaps of tens of milliseconds between at least some tokens.
    """
    times = t["token_times"]
    gaps = [later - earlier for earlier, later in zip(times, times[1:])]
    return len(times) >= 3 and sum(gap > 0.01 for gap in gaps) >= 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("base_url", help="backend URL, e.g. https://learnmate-backend-koe5.onrender.com")
    base = parser.parse_args().base_url.rstrip("/")

    session = str(uuid.uuid4())
    client = httpx.Client(headers={"X-Session-Id": session}, timeout=60)
    try:
        pdf = make_pdf("Photosynthesis happens in chloroplasts. Mitochondria produce ATP through cellular respiration.")
        client.post(f"{base}/upload", files={"file": ("streaming-check.pdf", pdf, "application/pdf")}).raise_for_status()
        t = stream_timings(client, base)
    except Exception as error:
        print(f"FAILED: {error}")
        return 2
    finally:
        try:
            client.delete(f"{base}/session")  # leave nothing behind
        except Exception:
            pass

    ok = verdict(t)
    gaps = sum(b - a > 0.01 for a, b in zip(t["token_times"], t["token_times"][1:]))
    print(f"tokens: {t['tokens']}  first token: {t['first_token_s']:.2f}s  last token: {t['last_token_s']:.2f}s  done: {t['done_s']:.2f}s  gaps >10ms: {gaps}")
    print("STREAMING OK: tokens arrived incrementally" if ok else "BUFFERED: tokens arrived in one burst; check proxy buffering/compression for text/event-stream")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
