"""Phase 7 endpoints: client config, erasing a session, answer feedback."""
import pytest
from fastapi.testclient import TestClient
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding

from app import main
from app import vector_store as vector_store_module
from app.config import settings
from app.learning_analytics import learning_analytics
from app.services import services
from app.sessions import SessionStoreRegistry

ME = "ffffffff-0000-0000-0000-000000000006"
OTHER = "99999999-0000-0000-0000-000000000007"


def client(session_id=ME):
    return TestClient(main.app, headers={"X-Session-Id": session_id})


def test_config_exposes_limits_without_a_session(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size", 5 * 1024 * 1024)
    assert TestClient(main.app).get("/config").json() == {"max_upload_size": 5 * 1024 * 1024, "max_documents_per_session": settings.max_documents_per_session}


def test_delete_session_erases_only_the_callers_data(monkeypatch, tmp_path):
    monkeypatch.setattr(vector_store_module, "OpenAIEmbeddings", lambda **kwargs: DeterministicFakeEmbedding(size=16))
    monkeypatch.setattr(services, "session_stores", SessionStoreRegistry("k", root_dir=str(tmp_path / "sessions")))
    monkeypatch.setattr(services, "analytics", learning_analytics)
    monkeypatch.setattr(services.document_processor, "process_document", lambda f, c: [Document(page_content="t", metadata={"source": f})])

    for who in (ME, OTHER):
        assert client(who).post("/upload", files={"file": ("n.pdf", b"%PDF-1", "application/pdf")}).status_code == 200
        client(who).post("/conversations", json={"title": "chat"})

    response = client().delete("/session")
    assert response.status_code == 200
    assert response.json()["deleted"]["conversations"] == 1

    assert client().get("/current-session-documents").json()["documents"] == []
    assert client().get(f"/conversations/user/{ME}").json()["conversations"] == []
    assert client().get(f"/analytics/user/{ME}").json() == {}
    # Someone else's data is untouched
    assert client(OTHER).get("/current-session-documents").json()["documents"] == ["n.pdf"]
    assert len(client(OTHER).get(f"/conversations/user/{OTHER}").json()["conversations"]) == 1


def test_feedback_is_recorded_as_a_metric(monkeypatch):
    monkeypatch.setattr(services, "analytics", learning_analytics)
    conversation_id = client().post("/conversations", json={}).json()["conversation_id"]

    assert client().post("/analytics/feedback", json={"rating": "up", "conversation_id": conversation_id, "model": "gpt-test"}).status_code == 200
    assert client().post("/analytics/feedback", json={"rating": "down"}).status_code == 200

    metrics = TestClient(main.app).get("/analytics/performance-metrics", params={"metric_name": "answer_feedback"}).json()["metrics"]
    assert [m["value"] for m in metrics[-2:]] == [1, -1]
    assert metrics[-2]["context"] == {"rating": "up", "model": "gpt-test"}


@pytest.mark.parametrize("body, status", [({"rating": "meh"}, 422), ({"rating": "up", "conversation_id": "conv_not_mine"}, 404)])
def test_feedback_validation(body, status):
    assert client().post("/analytics/feedback", json=body).status_code == status
