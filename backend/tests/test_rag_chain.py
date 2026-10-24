import asyncio

import pytest

from app import rag_chain as rag_module
from app.rag_chain import NO_CONTEXT_ANSWER, RAGChain
from app.errors import UserFacingError
from app.schemas import Quiz, QuizGenerationError
from conftest import FakeLLM, FakeVectorStore

USAGE = {"input_tokens": 120, "output_tokens": 2, "total_tokens": 122}


class RecordingMemory:
    def __init__(self):
        self.messages = []

    def get_conversation_history(self, conversation_id, limit=5):
        return [{"role": "user", "content": "Earlier question {with braces}"}]

    def add_message(self, conversation_id, role, content, metadata=None):
        self.messages.append((role, content, metadata))


@pytest.fixture
def memory(monkeypatch):
    recorder = RecordingMemory()
    monkeypatch.setattr(rag_module, "conversation_memory", recorder)
    monkeypatch.setattr(rag_module, "learning_analytics", None)
    return recorder


def make_chain(llm, vector_store=None):
    chain = RAGChain("test-key", vector_store or FakeVectorStore())
    chain.llm = chain.summary_llm = chain.quiz_llm = llm
    return chain


async def collect(stream):
    return [event async for event in stream]


def test_stream_answer_emits_meta_tokens_and_done_with_telemetry(memory):
    llm = FakeLLM(tokens=("ATP", " is energy."), usage=USAGE)
    events = asyncio.run(collect(make_chain(llm).stream_answer("What is ATP?", conversation_id="conv_1")))

    assert [e["type"] for e in events] == ["meta", "token", "token", "done"]
    meta, done = events[0], events[-1]
    assert meta["sources"][0] == {
        "rank": 1,
        "source": "biology.pdf",
        "distance": 0.21,
        "characters": 54,
        "preview": "Mitochondria produce ATP through cellular respiration.",
    }

    telemetry = done["telemetry"]
    assert telemetry["model"] == make_chain(llm).model_name
    assert telemetry["usage"] == {**USAGE, "estimated": False}
    assert telemetry["ttft_ms"] is not None and telemetry["ttft_ms"] <= telemetry["total_ms"]
    assert telemetry["finish_reason"] == "stop"
    assert "What is ATP?" in telemetry["system_prompt"]
    # History with braces must not break prompt formatting
    assert "Earlier question {with braces}" in llm.prompts[0]

    # Exchange persisted, without the (large) system prompt
    assert [(role, content) for role, content, _ in memory.messages] == [("user", "What is ATP?"), ("assistant", "ATP is energy.")]
    stored = memory.messages[1][2]["telemetry"]
    assert "system_prompt" not in stored and stored["usage"]["total_tokens"] == 122


def test_stream_answer_without_matches_skips_llm(memory):
    llm = FakeLLM()
    events = asyncio.run(collect(make_chain(llm, FakeVectorStore(results=[])).stream_answer("Anything?")))

    assert [e["type"] for e in events] == ["meta", "token", "done"]
    assert events[1]["content"] == NO_CONTEXT_ANSWER
    assert events[-1]["telemetry"]["usage"]["total_tokens"] == 0
    assert llm.prompts == []


def test_usage_is_estimated_when_provider_omits_it(memory):
    events = asyncio.run(collect(make_chain(FakeLLM(usage=None)).stream_answer("Q?")))
    usage = events[-1]["telemetry"]["usage"]
    assert usage["estimated"] is True and usage["input_tokens"] > 0


def test_closing_stream_early_cancels_llm_and_skips_persistence(memory):
    llm = FakeLLM(tokens=("one", "two", "three"), usage=USAGE)

    async def consume_first_token():
        stream = make_chain(llm).stream_answer("Q?")
        async for event in stream:
            if event["type"] == "token":
                break
        await stream.aclose()  # what Starlette does when the client disconnects

    asyncio.run(consume_first_token())
    assert llm.closed is True
    assert memory.messages == []


def test_stream_summary_streams_markdown_prompt(memory):
    llm = FakeLLM(tokens=("## Overview",), usage=USAGE)
    events = asyncio.run(collect(make_chain(llm).stream_summary(["biology.pdf"])))
    assert [e["type"] for e in events] == ["meta", "token", "done"]
    assert "Markdown" in events[-1]["telemetry"]["system_prompt"]


def test_stream_summary_without_content_raises_user_facing_error(memory):
    with pytest.raises(UserFacingError, match="No suitable content"):
        asyncio.run(collect(make_chain(FakeLLM(), FakeVectorStore(results=[])).stream_summary()))


def quiz_question(correct="B"):
    return {
        "question": "What does the mitochondrion produce?",
        "options": {"A": "DNA", "B": "ATP", "C": "Lipids", "D": "Glucose"},
        "correct_answer": correct,
        "explanation": "Cellular respiration.",
    }


class RawMessage:
    usage_metadata = USAGE


def test_generate_quiz_returns_validated_questions_and_telemetry(memory):
    parsed = Quiz.model_validate({"questions": [quiz_question(), quiz_question("A")]})
    llm = FakeLLM(structured_result={"raw": RawMessage(), "parsed": parsed, "parsing_error": None})

    result = asyncio.run(make_chain(llm).generate_quiz(1, "easy"))

    assert result["questions"] == [quiz_question()]  # trimmed to num_questions
    assert result["telemetry"]["structured_output"] == {"schema": "Quiz", "method": "function_calling", "validated": True, "items": 1}
    assert result["telemetry"]["usage"]["total_tokens"] == 122


def test_generate_quiz_raises_when_output_fails_validation(memory):
    llm = FakeLLM(structured_result={"raw": RawMessage(), "parsed": None, "parsing_error": ValueError("bad")})
    with pytest.raises(QuizGenerationError):
        asyncio.run(make_chain(llm).generate_quiz(3, "easy"))


def test_quiz_schema_rejects_invalid_answer_letter():
    with pytest.raises(ValueError):
        Quiz.model_validate({"questions": [quiz_question(correct="E")]})
