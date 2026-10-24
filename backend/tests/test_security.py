"""Phase 5: error hygiene, upload limits, rate limiting, CORS, headers, debug endpoints, storage format."""
import json
import os
import pickle
import time

import pytest
from fastapi.testclient import TestClient
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding

from app import main
from app.config import DEFAULT_PRODUCTION_ORIGINS, Settings, settings
from app.services import services
from app import rag_chain as rag_module
from app import rate_limit
from app import vector_store as vector_store_module
from app.document_processor import DocumentProcessor
from app.errors import UserFacingError
from app.rate_limit import RatePolicy, SlidingWindowLimiter
from app.sessions import SessionStoreRegistry
from app.vector_store import VectorStore
from conftest import FakeLLM, FakeVectorStore

SESSION = "cccccccc-0000-0000-0000-000000000003"
OTHER = "dddddddd-0000-0000-0000-000000000004"
PDF = b"%PDF-1.4 fake"


@pytest.fixture
def offline_registry(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store_module, "OpenAIEmbeddings", lambda **kwargs: DeterministicFakeEmbedding(size=16))
    registry = SessionStoreRegistry("test-key", root_dir=str(tmp_path / "sessions"))
    monkeypatch.setattr(services, "session_stores", registry)
    monkeypatch.setattr(services, "analytics", None)
    monkeypatch.setattr(
        services.document_processor,
        "process_document",
        lambda filename, content: [Document(page_content="text", metadata={"source": filename, "file_size": len(content)})],
    )
    return registry


def client(session_id=SESSION, **kwargs):
    return TestClient(main.app, headers={"X-Session-Id": session_id}, **kwargs)


# ----- 5.1 errors never leak internals -----

def test_unexpected_errors_return_generic_message_with_reference(offline_registry, monkeypatch, caplog):
    def boom(*args, **kwargs):
        raise RuntimeError("secret internal detail: /etc/passwd")

    monkeypatch.setattr(offline_registry, "get", boom)
    response = client().get("/current-session-documents")

    assert response.status_code == 500
    detail = response.json()["detail"]
    assert "secret" not in detail and "/etc/passwd" not in detail
    assert "ref " in detail
    ref = detail.split("ref ")[1].rstrip(")")
    assert any(ref in record.getMessage() for record in caplog.records)  # traceback logged under the same ref


def test_unhandled_errors_keep_cors_headers(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("kaboom")

    monkeypatch.setattr(services.analytics, "get_global_analytics", boom)
    response = TestClient(main.app, raise_server_exceptions=False).get(
        "/analytics/global", headers={"Origin": "http://localhost:8080"}
    )
    # analytics/global catches and returns a referenced 500 itself; either way: no leak, CORS intact
    assert response.status_code == 500
    assert "kaboom" not in response.text
    assert response.headers.get("access-control-allow-origin") == "http://localhost:8080"


def test_truly_unhandled_exceptions_are_caught_inside_cors():
    if not any(getattr(r, "path", None) == "/__test_unhandled" for r in main.app.routes):
        @main.app.get("/__test_unhandled")
        def explode():
            raise RuntimeError("raw internal message")

    response = TestClient(main.app, raise_server_exceptions=False).get("/__test_unhandled", headers={"Origin": "http://localhost:8080"})
    assert response.status_code == 500
    assert "raw internal message" not in response.text
    assert "(ref " in response.json()["detail"]
    assert response.headers.get("access-control-allow-origin") == "http://localhost:8080"
    assert response.headers.get("x-content-type-options") == "nosniff"


def test_stream_errors_hide_internals(monkeypatch):
    fake = FakeVectorStore()
    monkeypatch.setattr(services.session_stores, "get", lambda session_id: fake)
    monkeypatch.setattr(rag_module, "conversation_memory", None)
    monkeypatch.setattr(rag_module, "learning_analytics", None)

    class ExplodingLLM(FakeLLM):
        async def astream(self, messages):
            raise RuntimeError("sk-live-api-key-leak")
            yield  # pragma: no cover

    monkeypatch.setattr(services.rag_chain, "llm", ExplodingLLM())
    body = client().post("/ask/stream", json={"question": "hi"}).text
    assert "sk-live" not in body
    assert "Answer generation failed. Please try again. (ref " in body


def test_unreadable_pdf_is_a_clear_422():
    with pytest.raises(UserFacingError) as error:
        DocumentProcessor().process_document("broken.pdf", b"%PDF-not really")
    assert error.value.status_code == 422
    assert "couldn't be read" in error.value.message


# ----- 5.2 upload limits -----

def test_rejects_non_pdf_content_even_with_pdf_extension(offline_registry):
    response = client().post("/upload", files={"file": ("evil.pdf", b"MZ\x90\x00 executable", "application/pdf")})
    assert response.status_code == 415
    assert response.json()["detail"] == "This file isn't a valid PDF."


def test_rejects_oversized_uploads(offline_registry, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size", 1024)
    response = client().post("/upload", files={"file": ("big.pdf", PDF + b"x" * 200_000, "application/pdf")})
    assert response.status_code == 413
    assert "maximum size" in response.json()["detail"]


def test_rejects_declared_oversize_before_reading_body(offline_registry, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size", 1024)
    response = client().post("/upload", content=b"x" * 10, headers={"Content-Length": str(10_000_000), "Content-Type": "multipart/form-data; boundary=x"})
    assert response.status_code == 413


def test_strips_paths_from_filenames(offline_registry):
    response = client().post("/upload", files={"file": ("../../etc/notes.pdf", PDF, "application/pdf")})
    assert response.status_code == 200
    assert response.json()["details"]["file_name"] == "notes.pdf"


def test_document_count_limit_per_session(offline_registry, monkeypatch):
    monkeypatch.setattr(settings, "max_documents_per_session", 2)
    c = client()
    for name in ("a.pdf", "b.pdf"):
        assert c.post("/upload", files={"file": (name, PDF, "application/pdf")}).status_code == 200
    assert c.post("/upload", files={"file": ("c.pdf", PDF, "application/pdf")}).status_code == 409
    # Replacing an existing document is still allowed at the limit
    assert c.post("/upload", files={"file": ("a.pdf", PDF, "application/pdf")}).status_code == 200


def test_chunk_limit_per_document(offline_registry, monkeypatch):
    monkeypatch.setattr(settings, "max_chunks_per_document", 1)
    monkeypatch.setattr(services.document_processor, "process_document", lambda f, c: [Document(page_content="x", metadata={"source": f})] * 3)
    response = client().post("/upload", files={"file": ("huge.pdf", PDF, "application/pdf")})
    assert response.status_code == 413
    assert offline_registry.get(SESSION).document_summaries() == {}


# ----- 5.3 rate limiting -----

def test_sliding_window_expires_hits():
    now = [0.0]
    limiter = SlidingWindowLimiter(2, 60, clock=lambda: now[0])
    limiter.record("k")
    limiter.record("k")
    assert limiter.retry_after("k") == pytest.approx(60)
    now[0] = 30
    assert limiter.retry_after("k") == pytest.approx(30)
    now[0] = 60.01
    assert limiter.retry_after("k") is None


def test_ai_endpoints_are_rate_limited_per_session(monkeypatch):
    monkeypatch.setattr(rate_limit.AI_POLICY, "per_session", SlidingWindowLimiter(2, 60))
    monkeypatch.setattr(services.session_stores, "get", lambda session_id: FakeVectorStore())
    monkeypatch.setattr(rag_module, "conversation_memory", None)
    monkeypatch.setattr(rag_module, "learning_analytics", None)
    monkeypatch.setattr(services.rag_chain, "llm", FakeLLM())

    c = client()
    assert [c.post("/ask/stream", json={"question": "q"}).status_code for _ in range(2)] == [200, 200]
    limited = c.post("/ask/stream", json={"question": "q"})
    assert limited.status_code == 429
    assert int(limited.headers["Retry-After"]) >= 1
    assert "Too many AI requests" in limited.json()["detail"]
    # Another session is unaffected by this session's limit
    assert client(OTHER).post("/ask/stream", json={"question": "q"}).status_code == 200


def test_rotating_session_ids_hits_the_ip_limit():
    policy = RatePolicy("AI", per_session=SlidingWindowLimiter(100, 60), per_ip=SlidingWindowLimiter(3, 60))
    for i in range(3):
        policy.check(f"session-{i:016d}", "203.0.113.7")
    with pytest.raises(Exception) as error:
        policy.check("fresh-session-0000000", "203.0.113.7")
    assert error.value.status_code == 429


def test_blocked_requests_do_not_consume_quota():
    policy = RatePolicy("AI", per_session=SlidingWindowLimiter(1, 60), per_ip=SlidingWindowLimiter(10, 60))
    policy.check("s" * 16, "ip")
    for _ in range(5):
        with pytest.raises(Exception):
            policy.check("s" * 16, "ip")
    assert len(policy.per_ip._hits["ip"]) == 1


# ----- 5.5 CORS -----

def test_cors_allows_configured_origin_and_session_header():
    response = TestClient(main.app).options(
        "/current-session-documents",
        headers={"Origin": "http://localhost:8080", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-session-id"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8080"
    assert "access-control-allow-credentials" not in response.headers


def test_cors_rejects_unknown_origin():
    response = TestClient(main.app).options(
        "/current-session-documents",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in response.headers


def test_production_cors_uses_only_configured_origins(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com, https://www.example.com")
    assert Settings().allowed_origins == ["https://app.example.com", "https://www.example.com"]
    monkeypatch.setenv("CORS_ORIGINS", "")
    assert Settings().allowed_origins == DEFAULT_PRODUCTION_ORIGINS
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:9999")
    origins = Settings().allowed_origins
    assert "http://localhost:8080" in origins and "http://localhost:9999" in origins


# ----- headers & 5.7 debug endpoints -----

def test_security_headers_present():
    response = TestClient(main.app).get("/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"


def test_debug_endpoints_hidden_by_default():
    c = TestClient(main.app)
    assert c.get("/voice/connections").status_code == 404
    assert c.get("/voice/test").status_code == 404


def test_debug_endpoints_can_be_enabled(monkeypatch):
    monkeypatch.setattr(settings, "enable_debug_endpoints", True)
    assert TestClient(main.app).get("/voice/connections").status_code == 200


# ----- 5.6 storage format -----

def test_metadata_saved_as_json_and_legacy_pickle_migrated(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store_module, "OpenAIEmbeddings", lambda **kwargs: DeterministicFakeEmbedding(size=16))
    store_dir = str(tmp_path / "s")
    store = VectorStore("k", store_dir=store_dir)
    store.add_documents([Document(page_content="hello", metadata={"source": "a.pdf"})])
    with open(os.path.join(store_dir, "metadata.json"), encoding="utf-8") as f:
        assert json.load(f)[0] == {"page_content": "hello", "metadata": {"source": "a.pdf"}}

    # Simulate an index saved by the previous (pickle) format
    os.remove(os.path.join(store_dir, "metadata.json"))
    with open(os.path.join(store_dir, "metadata.pkl"), "wb") as f:
        pickle.dump(store.documents, f)

    migrated = VectorStore("k", store_dir=store_dir)
    assert list(migrated.document_summaries()) == ["a.pdf"]
    assert os.path.exists(os.path.join(store_dir, "metadata.json"))
    assert not os.path.exists(os.path.join(store_dir, "metadata.pkl"))


# ----- 8.6 shared (Redis) rate limits -----

def test_redis_limiter_shares_limits_across_workers():
    import fakeredis
    from app.rate_limit import RedisSlidingWindowLimiter

    server = fakeredis.FakeServer()
    now = [1000.0]
    # Two "workers", each with its own client and limiter object, backed by the same Redis
    worker_a = RedisSlidingWindowLimiter(fakeredis.FakeRedis(server=server), "ai:session", 2, 60, clock=lambda: now[0])
    worker_b = RedisSlidingWindowLimiter(fakeredis.FakeRedis(server=server), "ai:session", 2, 60, clock=lambda: now[0])

    worker_a.record("s1")
    worker_b.record("s1")
    assert worker_a.retry_after("s1") == pytest.approx(60)  # b's hit counts against a
    assert worker_b.retry_after("other") is None
    now[0] += 61
    assert worker_a.retry_after("s1") is None  # window slid


def test_redis_limiter_fails_open_when_redis_is_down():
    import redis
    from app.rate_limit import RedisSlidingWindowLimiter

    from redis.backoff import NoBackoff
    from redis.retry import Retry

    unreachable = redis.Redis(host="127.0.0.1", port=1, socket_connect_timeout=0.2, socket_timeout=0.2, retry=Retry(NoBackoff(), 0))
    limiter = RedisSlidingWindowLimiter(unreachable, "ai:session", 1, 60)
    started = time.monotonic()
    limiter.record("s1")
    assert limiter.retry_after("s1") is None
    assert time.monotonic() - started < 1.5  # fails open fast, no retry storm


def test_make_limiter_picks_backend():
    import fakeredis
    from app.rate_limit import RedisSlidingWindowLimiter, make_limiter

    assert isinstance(make_limiter("x", 5, 60), SlidingWindowLimiter)
    assert isinstance(make_limiter("x", 5, 60, fakeredis.FakeRedis()), RedisSlidingWindowLimiter)
