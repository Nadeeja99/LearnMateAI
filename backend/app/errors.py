"""
Error handling that never leaks internals to clients.

- UserFacingError: an expected condition whose message is safe and useful to show
  (bad PDF, file too large, ...). It is an HTTPException, so FastAPI returns it as-is.
- internal_error(): for everything else. The client gets a generic message plus a short
  reference; the full traceback is logged server-side under the same reference.
"""

import logging
import uuid

from fastapi import HTTPException

from .logging_setup import request_id_var

logger = logging.getLogger(__name__)


class UserFacingError(HTTPException):
    """An error whose message is safe to return to the client."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(status_code=status_code, detail=message)
        self.message = message


def new_error_ref() -> str:
    """The current request id (so the ref matches the request's log lines), else a fresh id."""
    request_id = request_id_var.get()
    return request_id if request_id != "-" else uuid.uuid4().hex[:8]


def internal_error(action: str) -> HTTPException:
    """Log the active exception with a reference id and return a generic 500.

    Call from inside an `except` block: `raise internal_error("Generating the summary")`.
    """
    ref = new_error_ref()
    logger.exception(f"{action} failed [ref {ref}]")
    return HTTPException(status_code=500, detail=f"{action} failed. Please try again. (ref {ref})")
