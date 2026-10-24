"""Session isolation and persistence, using real FAISS indexes with offline embeddings."""
import json
import os
import time

import pytest
from fastapi.testclient import TestClient
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding

from app import main
from app import rag_chain as rag_module
from app import vector_store as vector_store_module
from app.conversation_memory import conversation_memory
from app.learning_analytics import learning_analytics as real_learning_analytics
from app.sessions import SessionStoreRegistry, is_valid_session_id
from conftest import FakeLLM

ALICE = "aaaaaaaa-0000-0000-0000-000000000001"
BOB = "bbbbbbbb-0000-0000-0000-000000000002"


@pytest.fixture
def registry(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store_module, "OpenAIEmbeddings", lambda **kwargs: DeterministicFakeEmbedding(size=16))
    registry = SessionStoreRegistry("test-key", root_dir=str(tmp_path / "sessions"))
    monkeypatch.setattr(main, "session_stores", registry)
    return registry


@pytest.fixture
def api(monkeypatch, registry):
    monkeypatch.setattr(rag_module, "learning_analytics", None)
    monkeypatch.setattr(main, "learning_analytics", None)
    monkeypatch.setattr(main.rag_chain, "llm", FakeLLM(tokens=("ok",)))

    def fake_process(filename, content):
        text = content.decode().removeprefix("%PDF-")
        return [Document(page_content=f"{text} part {i}", metadata={"source": filename, "file_size": len(content), "text_length": len(text)}) for i in range(2)]

    monkeypatch.setattr(main.document_processor, "process_document", fake_process)

    def client_for(session_id):
        return TestClient(main.app, headers={"X-Session-Id": session_id})

    return client_for


def upload(client, filename, text):
    response = client.post("/upload", files={"file": (filename, b"%PDF-" + text.encode(), "application/pdf")})
    assert response.status_code == 200, response.text
    return response


def session_documents(client):
    return client.get("/current-session-documents").json()["documents"]


def test_documents_are_isolated_per_session(api):
    alice, bob = api(ALICE), api(BOB)
    upload(alice, "alice-notes.pdf", "mitochondria")

    assert session_documents(alice) == ["alice-notes.pdf"]
    assert session_documents(bob) == []
    # Bob has no index at all, so AI endpoints refuse rather than searching Alice's
    assert bob.post("/ask/stream", json={"question": "What is ATP?"}).status_code == 400


def test_same_filename_in_two_sessions_does_not_collide(api, registry):
    alice, bob = api(ALICE), api(BOB)
    upload(alice, "notes.pdf", "alice text")
    upload(bob, "notes.pdf", "bob text")

    alice_chunks = [d.page_content for d in registry.get(ALICE).get_all_documents()]
    assert alice_chunks and all(c.startswith("alice text") for c in alice_chunks)

    bob.delete("/documents/notes.pdf")
    assert session_documents(alice) == ["notes.pdf"]
    assert session_documents(bob) == []


def test_reupload_replaces_instead_of_duplicating(api, registry):
    alice = api(ALICE)
    upload(alice, "notes.pdf", "v1")
    upload(alice, "notes.pdf", "v2")
    contents = sorted(d.page_content for d in registry.get(ALICE).get_all_documents())
    assert contents == ["v2 part 0", "v2 part 1"]


def test_documents_survive_a_server_restart(api, registry, tmp_path):
    upload(api(ALICE), "notes.pdf", "persisted")

    # A new registry is what a restart builds; nothing is wiped on startup any more
    restarted = SessionStoreRegistry("test-key", root_dir=registry.root_dir)
    store = restarted.get(ALICE)
    assert list(store.document_summaries()) == ["notes.pdf"]
    assert store.document_summaries()["notes.pdf"]["chunks_count"] == 2
    assert store.search_similar("persisted", k=1)[0]["metadata"]["source"] == "notes.pdf"


def test_clear_documents_only_clears_the_callers_session(api):
    alice, bob = api(ALICE), api(BOB)
    upload(alice, "a.pdf", "a")
    upload(bob, "b.pdf", "b")
    assert alice.delete("/clear-documents").status_code == 200
    assert session_documents(alice) == []
    assert session_documents(bob) == ["b.pdf"]


def test_requests_without_a_valid_session_are_rejected(api):
    anonymous = TestClient(main.app)
    assert anonymous.get("/current-session-documents").status_code == 400
    for bad in ("short", "../../etc/passwd-aaaaaaaaaa", "a" * 65, "has spaces in it 12345"):
        response = anonymous.get("/current-session-documents", headers={"X-Session-Id": bad})
        assert response.status_code == 400, bad


def test_conversations_and_analytics_are_private(api):
    alice, bob = api(ALICE), api(BOB)
    conversation_id = alice.post("/conversations", json={"title": "Alice chat", "user_id": "default"}).json()["conversation_id"]

    assert conversation_memory.owns(conversation_id, ALICE)  # owner comes from the session, not the body
    assert alice.get(f"/conversations/{conversation_id}/history").status_code == 200
    assert bob.get(f"/conversations/{conversation_id}/history").status_code == 404
    assert bob.delete(f"/conversations/{conversation_id}").status_code == 404
    assert bob.get(f"/conversations/user/{ALICE}").status_code == 403
    assert bob.get(f"/analytics/user/{ALICE}").status_code == 403
    assert [c["id"] for c in alice.get(f"/conversations/user/{ALICE}").json()["conversations"]] == [conversation_id]

    upload(bob, "b.pdf", "b")
    response = bob.post("/ask/stream", json={"question": "hi", "conversation_id": conversation_id})
    assert response.status_code == 404


def test_session_id_validation():
    assert is_valid_session_id("0b1e8c5e-6a0f-4e51-9b0a-3c1f4d2e5a6b")
    assert not is_valid_session_id(None)
    assert not is_valid_session_id("../x" * 5)


def test_cleanup_removes_only_expired_sessions(api, registry):
    upload(api(ALICE), "old.pdf", "old")
    upload(api(BOB), "new.pdf", "new")

    old_time = time.time() - 40 * 86400
    for dirpath, _, files in os.walk(os.path.join(registry.root_dir, ALICE)):
        for name in files:
            os.utime(os.path.join(dirpath, name), (old_time, old_time))

    assert registry.cleanup_expired(30) == 1
    assert sorted(os.listdir(registry.root_dir)) == [BOB]


def test_session_ids_never_appear_in_shared_or_semi_public_data(api, monkeypatch):
    alice = api(ALICE)
    conversation_id = alice.post("/conversations", json={}).json()["conversation_id"]
    assert ALICE not in conversation_id  # conversation ids surface in /voice/connections

    monkeypatch.setattr(main, "learning_analytics", real_learning_analytics)
    assert alice.post("/analytics/track-quiz", json={"quiz_score": 2, "total_questions": 2, "score_percentage": 100}).status_code == 200
    metrics = TestClient(main.app).get("/analytics/performance-metrics").json()["metrics"]
    assert any(m["metric_name"] == "quiz_score_percentage" for m in metrics)
    assert ALICE not in json.dumps(metrics)
