"""
LearnMate AI API: application setup, middleware, and router registration.

Endpoints live in app/api/*; runtime singletons in app/services.py; settings in app/config.py.
"""

import logging
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .logging_setup import configure_logging, new_request_id, request_id_var

configure_logging(settings.log_level, settings.log_format)

from .api import ai, analytics, conversations, documents, voice  # noqa: E402
from .api.documents import too_large_message  # noqa: E402
from .errors import new_error_ref  # noqa: E402
from .langfuse_config import langfuse_config  # noqa: E402
from .services import init_services, services  # noqa: E402

logger = logging.getLogger(__name__)

app = FastAPI(
    title="LearnMate AI - RAG System",
    version="1.0.0",
    description="Personal Learning Assistant API with RAG for document processing and AI-powered interactions",
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = new_request_id(request.headers.get("x-request-id"))
    token = request_id_var.set(request_id)
    try:
        # Reject oversized uploads before the multipart body is read and spooled
        declared = request.headers.get("content-length")
        if (
            request.url.path == "/upload"
            and request.method == "POST"
            and declared
            and declared.isdigit()
            and int(declared) > settings.max_upload_size + 64 * 1024
        ):
            response = JSONResponse(status_code=413, content={"detail": too_large_message()})
        else:
            try:
                response = await call_next(request)
            except Exception as exc:
                # Handled here (inside CORS) rather than by the outermost error middleware, so the
                # browser still receives CORS headers and can read the error instead of a network failure
                logger.error(f"Unhandled error on {request.method} {request.url.path} [ref {request_id}]", exc_info=exc)
                response = JSONResponse(status_code=500, content={"detail": f"Something went wrong. Please try again. (ref {request_id})"})

        response.headers["X-Request-ID"] = request_id
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response
    finally:
        request_id_var.reset(token)


# Added after the middleware above, so CORS is outermost and also covers its early responses
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,  # the API uses the X-Session-Id header, never cookies
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Accept", "X-Session-Id", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """422 with one readable sentence (the frontend shows `detail` as-is)"""
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    message = first.get("msg", "Invalid request")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {message}" if field else message})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Last-resort handler: log the traceback, return nothing internal"""
    ref = new_error_ref()
    logger.error(f"Unhandled error on {request.method} {request.url.path} [ref {ref}]", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": f"Something went wrong. Please try again. (ref {ref})"})


for router in (documents.router, ai.router, conversations.router, analytics.router, voice.router):
    app.include_router(router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "rag_system": "initialized" if services.rag_chain else "not_initialized",
    }


init_services(settings)
logger.info(f"CORS allowed origins: {settings.allowed_origins}")
logger.info(f"LangFuse observability {'enabled' if langfuse_config.is_enabled() else 'disabled'}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
