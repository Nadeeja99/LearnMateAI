"""Phase 8: Langfuse generations carry model/usage/TTFT; model-performance aggregates."""
import asyncio
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app import main
from app import rag_chain as rag_module
from app.db import Database
from app.learning_analytics import LearningAnalytics, percentile
from app.rag_chain import RAGChain
from app.schemas import Quiz
from conftest import FakeLLM, FakeVectorStore

USAGE = {"input_tokens": 120, "output_tokens": 30, "total_tokens": 150}


class FakeGeneration:
    def __init__(self, kwargs):
        self.start_kwargs, self.updates, self.ended = kwargs, [], False

    def update(self, **kwargs):
        self.updates.append(kwargs)

    def end(self):
        self.ended = True

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.ended = True


class FakeLangfuse:
    def __init__(self):
        self.generations = []

    def is_enabled(self):
        return True

    def start_generation(self, name, **kwargs):
        self.generations.append(FakeGeneration({"name": name, **kwargs}))
        return self.generations[-1]

    def create_trace(self, name, **kwargs):
        return self.start_generation(name, **kwargs)


@pytest.fixture
def langfuse(monkeypatch):
    fake = FakeLangfuse()
    monkeypatch.setattr(rag_module, "langfuse_config", fake)
    monkeypatch.setattr(rag_module, "conversation_memory", None)
    monkeypatch.setattr(rag_module, "learning_analytics", None)
    return fake


def chain(llm):
    c = RAGChain("test-key", FakeVectorStore())
    c.llm = c.summary_llm = c.quiz_llm = llm
    return c


def test_streamed_answer_is_a_generation_with_usage_and_ttft(langfuse):
    async def run():
        return [e async for e in chain(FakeLLM(tokens=("a", "b"), usage=USAGE)).stream_answer("Q?")]

    asyncio.run(run())
    generation = langfuse.generations[0]
    assert generation.start_kwargs["name"] == "answer_question_stream"
    assert generation.start_kwargs["model"]
    final = generation.updates[-1]
    assert final["usage_details"] == {"input": 120, "output": 30, "total": 150}
    assert isinstance(final["completion_start_time"], datetime)
    assert final["metadata"]["usage_estimated"] is False
    assert "system_prompt" not in final["output"]["telemetry"]
    assert generation.ended


def test_quiz_generation_reports_usage(langfuse):
    class Raw:
        usage_metadata = USAGE

    parsed = Quiz.model_validate({"questions": [{"question": "q", "options": {"A": "a", "B": "b", "C": "c", "D": "d"}, "correct_answer": "A", "explanation": "e"}]})
    llm = FakeLLM(structured_result={"raw": Raw(), "parsed": parsed, "parsing_error": None})
    asyncio.run(chain(llm).generate_quiz(1, "easy"))
    assert langfuse.generations[0].updates[-1]["usage_details"]["total"] == 150


def test_aborted_stream_still_closes_the_generation(langfuse):
    async def run():
        stream = chain(FakeLLM(tokens=("a", "b", "c"), usage=USAGE)).stream_answer("Q?")
        async for event in stream:
            if event["type"] == "token":
                break
        await stream.aclose()

    asyncio.run(run())
    generation = langfuse.generations[0]
    assert generation.ended and "error" in generation.updates[-1]["output"]


def test_percentile():
    values = sorted([100, 200, 300, 400, 1000])
    assert percentile(values, 50) == 300
    assert percentile(values, 95) == 1000
    assert percentile([], 50) is None


def test_model_performance_aggregates(tmp_path, monkeypatch):
    analytics = LearningAnalytics(Database(str(tmp_path / "m.db")))
    for ttft, model in ((300, "gpt-a"), (500, "gpt-a"), (900, "gpt-b")):
        analytics.add_performance_metric("llm_ttft_ms", ttft, {"model": model})
    for rating in (1, 1, -1):
        analytics.add_performance_metric("answer_feedback", rating, {"rating": "up" if rating > 0 else "down"})
    analytics.add_performance_metric("quiz_score_percentage", 80)  # unrelated metric ignored

    stats = analytics.get_model_performance(30)
    assert stats["ttft_ms"] == {"count": 3, "p50": 500, "p95": 900, "mean": pytest.approx(566.67, 0.01)}
    assert stats["by_model"] == {"gpt-a": {"count": 2, "p50": 300}, "gpt-b": {"count": 1, "p50": 900}}
    assert stats["feedback"] == {"up": 2, "down": 1, "helpful_rate": pytest.approx(2 / 3)}
    assert len(stats["daily_ttft_p50"]) == 1

    from app.services import services
    monkeypatch.setattr(services, "analytics", analytics)
    assert TestClient(main.app).get("/analytics/model-performance").json()["ttft_ms"]["count"] == 3
