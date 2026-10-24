"""Phase 6: validation, request ids, logging, SQLite storage, analytics, async I/O, cheap deletes."""
import asyncio
import base64
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding

from app import main
from app import vector_store as vector_store_module
from app.conversation_memory import ConversationMemory
from app.db import Database
from app.learning_analytics import LearningAnalytics, learning_streak
from app.logging_setup import JsonFormatter, RequestIdFilter, request_id_var
from app.services import services
from app.vector_store import VectorStore
from app.voice_processing import VoiceProcessingService
from conftest import FakeVectorStore

SESSION = "eeeeeeee-0000-0000-0000-000000000005"


def client():
    return TestClient(main.app, headers={"X-Session-Id": SESSION})


# ----- 6.1 request validation -----

@pytest.mark.parametrize(
    "path, body, expected",
    [
        ("/generate-quiz", {"num_questions": 25}, "num_questions: Input should be less than or equal to 20"),
        ("/generate-quiz", {"difficulty": "impossible"}, "difficulty: Input should be 'easy', 'medium' or 'hard'"),
        ("/ask/stream", {}, "question: Field required"),
        ("/ask/stream", {"question": "x" * 4001}, "question: String should have at most 4000 characters"),
    ],
)
def test_invalid_bodies_get_a_readable_422(path, body, expected):
    response = client().post(path, json=body)
    assert response.status_code == 422
    assert response.json()["detail"] == expected


def test_legacy_fields_are_ignored_not_trusted(monkeypatch):
    monkeypatch.setattr(services.session_stores, "get", lambda session_id: FakeVectorStore())
    response = client().post("/conversations", json={"title": "t", "user_id": "someone-else"})
    assert response.status_code == 200
    assert services.conversations.owns(response.json()["conversation_id"], SESSION)


# ----- 6.6 request ids & structured logs -----

def test_every_response_carries_a_request_id():
    generated = TestClient(main.app).get("/health")
    assert len(generated.headers["x-request-id"]) == 12

    echoed = TestClient(main.app).get("/health", headers={"X-Request-ID": "trace-abc_123"})
    assert echoed.headers["x-request-id"] == "trace-abc_123"

    unsafe = TestClient(main.app).get("/health", headers={"X-Request-ID": "bad id\nwith newline"})
    assert unsafe.headers["x-request-id"] != "bad id\nwith newline"


def test_error_reference_is_the_request_id(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("internal")

    monkeypatch.setattr(services.session_stores, "get", boom)
    response = client().get("/current-session-documents", headers={"X-Request-ID": "req-42"})
    assert response.status_code == 500
    assert response.json()["detail"].endswith("(ref req-42)")


def test_json_log_lines_include_request_id():
    record = logging.LogRecord("app.test", logging.INFO, __file__, 1, "hello %s", ("world",), None)
    token = request_id_var.set("req-7")
    try:
        RequestIdFilter().filter(record)
    finally:
        request_id_var.reset(token)
    line = json.loads(JsonFormatter().format(record))
    assert line["request_id"] == "req-7" and line["message"] == "hello world" and line["level"] == "INFO"


# ----- 6.5 SQLite storage -----

@pytest.fixture
def db(tmp_path):
    return Database(str(tmp_path / "test.db"))


def test_conversation_round_trip_and_cascade_delete(db):
    memory = ConversationMemory(db)
    conv = memory.create_conversation("user-1", title="Biology")
    for i in range(12):
        memory.add_message(conv, "user" if i % 2 == 0 else "assistant", f"m{i}", {"i": i})

    history = memory.get_conversation_history(conv, limit=3)
    assert [m["content"] for m in history] == ["m9", "m10", "m11"]  # newest three, oldest first
    assert history[0]["metadata"] == {"i": 9}
    assert memory.get_user_conversations("user-1")[0]["message_count"] == 12
    assert memory.get_conversation_context(conv)["title"] == "Biology"

    with pytest.raises(ValueError):
        memory.add_message("conv_missing", "user", "x")

    memory.delete_conversation(conv)
    assert memory.get_user_conversations("user-1") == []
    assert db.query_one("SELECT COUNT(*) AS n FROM messages")["n"] == 0


def test_concurrent_writes_are_not_lost(db):
    memory = ConversationMemory(db)
    conv = memory.create_conversation("user-1")
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda i: memory.add_message(conv, "user", f"m{i}"), range(200)))
    assert len(memory.get_conversation_history(conv, limit=0)) == 200


def test_legacy_json_is_imported_once_and_kept(db, tmp_path):
    legacy = tmp_path / "conversations"
    legacy.mkdir()
    (legacy / "conversations.json").write_text(json.dumps({
        "conv_old": {
            "id": "conv_old", "user_id": "u", "title": "Old chat",
            "created_at": "2026-01-01T10:00:00", "updated_at": "2026-01-01T10:05:00",
            "document_context": ["a.pdf"], "summary": None,
            "messages": [{"id": "m1", "role": "user", "content": "hi", "timestamp": "2026-01-01T10:00:00", "metadata": {}}],
        }
    }))
    memory = ConversationMemory(db, legacy_dir=str(legacy))
    assert memory.get_conversation_history("conv_old") [0]["content"] == "hi"
    assert not (legacy / "conversations.json").exists()
    assert (legacy / "conversations.json.migrated").exists()

    ConversationMemory(db, legacy_dir=str(legacy))  # a restart must not duplicate anything
    assert len(memory.get_conversation_history("conv_old")) == 1


def test_analytics_are_derived_and_stable_across_reads(db):
    analytics = LearningAnalytics(db)
    for session_type in ("upload", "chat", "chat", "question", "voice_chat", "summary", "quiz"):
        analytics.track_session("user-1", session_type, document_name="notes.pdf" if session_type == "upload" else None)

    first = analytics.get_user_analytics("user-1")
    assert analytics.get_user_analytics("user-1") == first  # reads used to inflate total_chat_messages
    assert first["total_sessions"] == 7
    assert first["total_chat_messages"] == 3  # chat + legacy "question"
    assert first["total_questions_asked"] == 4  # + voice turns
    assert first["learning_streak_days"] == 1
    assert first["document_types_distribution"] == {"pdf": 1}
    assert analytics.get_user_analytics("nobody") == {}

    global_stats = analytics.get_global_analytics()
    assert global_stats["total_users"] == 1 and "user-1" not in json.dumps(global_stats)


def test_learning_streak():
    today = date(2026, 10, 24)
    days = lambda *offsets: {today - timedelta(days=o) for o in offsets}
    assert learning_streak(days(0, 1, 2), today) == 3
    assert learning_streak(days(1, 2), today) == 2  # today isn't over yet
    assert learning_streak(days(0, 2, 3), today) == 1
    assert learning_streak(days(3), today) == 0
    assert learning_streak(set(), today) == 0


# ----- 6.7 deletes don't re-embed -----

def test_delete_removes_vectors_without_re_embedding(monkeypatch, tmp_path):
    calls = []

    class CountingEmbedding(DeterministicFakeEmbedding):
        def embed_documents(self, texts):
            calls.extend(texts)
            return super().embed_documents(texts)

    monkeypatch.setattr(vector_store_module, "OpenAIEmbeddings", lambda **kwargs: CountingEmbedding(size=16))
    store = VectorStore("k", store_dir=str(tmp_path / "s"))
    store.add_documents([Document(page_content=f"a{i}", metadata={"source": "a.pdf"}) for i in range(3)])
    store.add_documents([Document(page_content=f"b{i}", metadata={"source": "b.pdf"}) for i in range(4)])
    calls.clear()

    store.delete_document("a.pdf")

    assert calls == []
    assert store.vector_store.index.ntotal == 4
    assert {r["metadata"]["source"] for r in store.search_similar("a0", k=10)} == {"b.pdf"}
    assert VectorStore("k", store_dir=str(tmp_path / "s")).vector_store.index.ntotal == 4


# ----- 6.3 non-blocking I/O -----

def test_voice_uses_async_openai_client():
    seen = {}

    def handler(request: httpx.Request):
        if request.url.path.endswith("/audio/transcriptions"):
            seen["multipart_has_audio"] = b'filename="audio.webm"' in request.read()
            return httpx.Response(200, json={"text": " hello "})
        return httpx.Response(200, content=b"MP3")

    service = VoiceProcessingService("test-key")
    service.openai_client = service.openai_client.with_options(http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))

    async def run():
        return await service.speech_to_text(base64.b64encode(b"AUDIO").decode()), await service.text_to_speech("hi")

    assert asyncio.run(run()) == ("hello", b"MP3")
    assert seen["multipart_has_audio"]


def test_upload_parsing_and_embedding_run_off_the_event_loop(monkeypatch, tmp_path):
    from app.sessions import SessionStoreRegistry

    monkeypatch.setattr(vector_store_module, "OpenAIEmbeddings", lambda **kwargs: DeterministicFakeEmbedding(size=16))
    monkeypatch.setattr(services, "session_stores", SessionStoreRegistry("k", root_dir=str(tmp_path / "sessions")))
    monkeypatch.setattr(services, "analytics", None)
    threads = {}

    def process(filename, content):
        try:
            asyncio.get_running_loop()
            threads["parse_on_event_loop"] = True
        except RuntimeError:  # no loop in this thread: we're in a worker, not blocking requests
            threads["parse_on_event_loop"] = False
        return [Document(page_content="t", metadata={"source": filename})]

    monkeypatch.setattr(services.document_processor, "process_document", process)
    response = client().post("/upload", files={"file": ("n.pdf", b"%PDF-1", "application/pdf")})
    assert response.status_code == 200
    assert threads["parse_on_event_loop"] is False
