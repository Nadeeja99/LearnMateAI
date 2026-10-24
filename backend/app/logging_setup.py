"""
Logging with per-request correlation ids.

Each HTTP request gets an id (the caller's X-Request-ID if it looks safe, else a new one).
It is attached to every log record emitted while handling the request, echoed back in the
X-Request-ID response header, and used as the "ref" shown in error messages, so a user's
error report maps straight to the matching log lines.

LOG_FORMAT=json emits one JSON object per line for log aggregators; "text" stays readable.
"""

import contextvars
import json
import logging
import re
import uuid
from datetime import datetime, timezone

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def new_request_id(incoming: str = None) -> str:
    return incoming if incoming and _SAFE_REQUEST_ID.fullmatch(incoming) else uuid.uuid4().hex[:12]


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO", fmt: str = "text") -> None:
    handler = logging.StreamHandler()
    handler.addFilter(RequestIdFilter())
    handler.setFormatter(
        JsonFormatter() if fmt == "json" else logging.Formatter("%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s")
    )
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
