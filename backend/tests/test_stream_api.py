import json

import pytest
from fastapi.testclient import TestClient

from app import main
from app.rag_chain import RAGChain
from app.services import services
from app import rag_chain as rag_module
from app.schemas import QuizGenerationError
from conftest import FakeLLM, FakeVectorStore


SESSION = {"X-Session-Id": "11111111-2222-3333-4444-555555555555"}


class EmptyVectorStore(FakeVectorStore):
    def has_documents(self):
        return False


@pytest.fixture
def store(monkeypatch):
    fake = FakeVectorStore()
    monkeypatch.setattr(services.session_stores, "get", lambda session_id: fake)
    return fake


@pytest.fixture
def client(monkeypatch, store):
    monkeypatch.setattr(rag_module, "conversation_memory", None)
    monkeypatch.setattr(rag_module, "learning_analytics", None)
    llm = FakeLLM(tokens=("Hi", " there"), usage={"input_tokens": 10, "output_tokens": 2, "total_tokens": 12})
    for attr in ("llm", "summary_llm", "quiz_llm"):
        monkeypatch.setattr(services.rag_chain, attr, llm)
    return TestClient(main.app, headers=SESSION)


def parse_sse(body: str):
    events = []
    for frame in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in frame.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def test_ask_stream_returns_sse_events(client):
    response = client.post("/ask/stream", json={"question": "Hello?"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(response.text)
    assert [name for name, _ in events] == ["meta", "token", "token", "done"]
    assert "".join(data["content"] for name, data in events if name == "token") == "Hi there"
    assert events[-1][1]["telemetry"]["usage"]["total_tokens"] == 12


def test_ask_stream_validates_before_streaming(client, monkeypatch):
    blank = client.post("/ask/stream", json={"question": "  "})
    assert blank.status_code == 422
    assert blank.json()["detail"].startswith("Question:")

    monkeypatch.setattr(services.session_stores, "get", lambda session_id: EmptyVectorStore())
    response = client.post("/ask/stream", json={"question": "Hello?"})
    assert response.status_code == 400
    assert "No documents" in response.json()["detail"]


def test_summary_stream_reports_errors_as_sse_event(client, store):
    store.results = []
    events = parse_sse(client.post("/summarize/stream", json={}).text)
    assert events == [("error", {"type": "error", "message": "No suitable content found for summarization"})]


def test_generate_quiz_maps_validation_failure_to_502(client, monkeypatch):
    async def invalid_quiz(*args, **kwargs):
        raise QuizGenerationError("The model returned a quiz that failed validation. Please try again.")

    monkeypatch.setattr(RAGChain, "generate_quiz", invalid_quiz)
    response = client.post("/generate-quiz", json={"num_questions": 3})
    assert response.status_code == 502
    assert "failed validation" in response.json()["detail"]
