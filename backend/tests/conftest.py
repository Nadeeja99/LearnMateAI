"""Test setup: isolate tests from real credentials, tracing, and the local data directory.

The working directory switch happens before any `app` import, so module-level singletons (conversation memory,
analytics, the vector store) are created inside a throwaway working directory.
"""
import asyncio
import os
import sys
import tempfile

import pytest

# load_dotenv() never overrides variables that are already set
os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["LANGFUSE_ENABLED"] = "false"

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)


def pytest_sessionstart(session):
    # After pytest resolves testpaths, before test modules (and app singletons) are imported
    os.chdir(tempfile.mkdtemp(prefix="learnmate-tests-"))


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Rate-limit windows are process-wide; start every test with a clean slate."""
    from app import rate_limit
    rate_limit.reset_all()
    yield


class FakeChunk:
    def __init__(self, content="", usage=None, finish_reason=None):
        self.content = content
        self.usage_metadata = usage
        self.response_metadata = {"finish_reason": finish_reason} if finish_reason else {}


class FakeResponse(FakeChunk):
    pass


class FakeStructuredLLM:
    def __init__(self, result):
        self.result = result

    async def ainvoke(self, messages):
        return self.result


class FakeLLM:
    """Stands in for ChatOpenAI: streams tokens, then a final usage chunk."""

    def __init__(self, tokens=("Hello", " world"), usage=None, structured_result=None):
        self.tokens = tokens
        self.usage = usage
        self.structured_result = structured_result
        self.prompts = []
        self.closed = False

    async def astream(self, messages):
        self.prompts.append(messages[0].content)
        try:
            for token in self.tokens:
                await asyncio.sleep(0)
                yield FakeChunk(token)
            yield FakeChunk("", usage=self.usage, finish_reason="stop")
        finally:
            self.closed = True

    async def ainvoke(self, messages):
        self.prompts.append(messages[0].content)
        return FakeResponse("".join(self.tokens), usage=self.usage, finish_reason="stop")

    def with_structured_output(self, schema, **kwargs):
        assert kwargs.get("method") == "function_calling"
        return FakeStructuredLLM(self.structured_result)


class FakeVectorStore:
    def __init__(self, results=None):
        self.results = results if results is not None else [
            {"content": "Mitochondria produce ATP through cellular respiration.", "metadata": {"source": "biology.pdf"}, "score": 0.21},
            {"content": "Chloroplasts perform photosynthesis.", "metadata": {"source": "biology.pdf"}, "score": 0.35},
        ]

    def has_documents(self):
        return True

    def search_similar(self, query, k=5, document_names=None):
        return self.results[:k]

    def get_all_documents(self):
        return []

    def document_summaries(self):
        return {"biology.pdf": {"filename": "biology.pdf", "chunks_count": len(self.results), "file_size": 1, "uploaded_at": None}}
