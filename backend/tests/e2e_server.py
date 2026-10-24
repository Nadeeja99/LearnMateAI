"""
The real LearnMate API for end-to-end tests: real endpoints, sessions, FAISS indexes and SQLite,
with only the paid parts faked (scripted LLM, offline embeddings, simplified PDF parsing).

Started by frontend/playwright.config.ts. Never use outside tests.

Test-only endpoints:
  GET  /__e2e/llm      LLM stream counters (started / completed / closed) - proves server-side cancel
  POST /__e2e/restart  rebuild services from disk, as a process restart would
"""

import asyncio
import os
import sys
import tempfile
import time

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ.update(
    OPENAI_API_KEY="test-key",
    LANGFUSE_ENABLED="false",
    LOG_LEVEL=os.environ.get("E2E_LOG_LEVEL", "WARNING"),
    MAX_UPLOAD_SIZE=os.environ.get("E2E_MAX_UPLOAD_SIZE", str(5 * 1024 * 1024)),
    RATE_LIMIT_AI_PER_MINUTE="0",  # the suite fires many requests from one IP
    RATE_LIMIT_AI_PER_IP_PER_MINUTE="0",
    RATE_LIMIT_UPLOADS_PER_HOUR="0",
    RATE_LIMIT_UPLOADS_PER_IP_PER_HOUR="0",
)
os.chdir(tempfile.mkdtemp(prefix="learnmate-e2e-"))
sys.path.insert(0, BACKEND_DIR)

import uvicorn  # noqa: E402
from langchain_core.documents import Document  # noqa: E402
from langchain_core.embeddings import DeterministicFakeEmbedding  # noqa: E402

from app import main  # noqa: E402
from app import vector_store as vector_store_module  # noqa: E402
from app.config import settings  # noqa: E402
from app.schemas import Quiz  # noqa: E402
from app.services import init_services, services  # noqa: E402

vector_store_module.OpenAIEmbeddings = lambda **kwargs: DeterministicFakeEmbedding(size=16)
STATS = {"started": 0, "completed": 0, "closed": 0}


class Chunk:
    def __init__(self, content="", usage=None, finish=None):
        self.content = content
        self.usage_metadata = usage
        self.response_metadata = {"finish_reason": finish} if finish else {}


def _sources(prompt: str) -> str:
    names = sorted({line.split("(", 1)[1].split(")", 1)[0] for line in prompt.splitlines() if line.startswith("Source ")})
    return ", ".join(names)


class ScriptedLLM:
    """Streams a Markdown answer (code block + table) naming the documents it was given."""

    def __init__(self, kind: str):
        self.kind = kind

    async def astream(self, messages):
        prompt = messages[0].content
        STATS["started"] += 1
        try:
            await asyncio.sleep(0.3)  # time to first token
            if "fail" in prompt.split("Question:")[-1]:
                raise RuntimeError("upstream model error")
            if self.kind == "summary":
                text = f"Overview of {_sources(prompt)}.\n\n## Organelles\n\n- **Mitochondria** produce ATP\n\n## Key Takeaways\n\n- Energy flows through ATP\n"
            else:
                text = (
                    f"**ATP** is the cell's energy currency. Answer grounded in: {_sources(prompt)}.\n\n"
                    "```python\ndef atp_yield(glucose: int) -> int:\n    return glucose * 30\n```\n\n"
                    "| Stage | ATP |\n|---|---|\n| Glycolysis | 2 |\n| Krebs cycle | 2 |\n"
                )
            for i in range(0, len(text), 4):
                await asyncio.sleep(0.03)
                yield Chunk(text[i : i + 4])
            yield Chunk(usage={"input_tokens": len(prompt) // 4, "output_tokens": len(text) // 4, "total_tokens": (len(prompt) + len(text)) // 4}, finish="stop")
            STATS["completed"] += 1
        finally:
            STATS["closed"] += 1


class ScriptedQuizLLM:
    def with_structured_output(self, schema, **kwargs):
        return self

    async def ainvoke(self, messages):
        await asyncio.sleep(0.8)

        class Raw:
            usage_metadata = {"input_tokens": 900, "output_tokens": 260, "total_tokens": 1160}

        parsed = Quiz.model_validate({"questions": [
            {"question": "What does the mitochondrion produce?", "options": {"A": "DNA", "B": "ATP", "C": "Lipids", "D": "Glucose"},
             "correct_answer": "B", "explanation": "Mitochondria generate ATP via cellular respiration."},
            {"question": "Where does photosynthesis occur?", "options": {"A": "Chloroplast", "B": "Nucleus", "C": "Ribosome", "D": "Vacuole"},
             "correct_answer": "A", "explanation": "Chloroplasts contain chlorophyll."},
        ]})
        return {"raw": Raw(), "parsed": parsed, "parsing_error": None}


def process_document(filename, content):
    if "slow" in filename:
        time.sleep(1.5)  # makes the UI's "Processing" state observable
    text = content.decode(errors="ignore").removeprefix("%PDF-")[:2000]
    return [Document(page_content=f"{text} (part {i})", metadata={"source": filename, "file_size": len(content), "text_length": len(text)}) for i in range(3)]


def install_fakes():
    services.document_processor.process_document = process_document
    services.rag_chain.llm = ScriptedLLM("answer")
    services.rag_chain.summary_llm = ScriptedLLM("summary")
    services.rag_chain.quiz_llm = ScriptedQuizLLM()


install_fakes()


@main.app.get("/__e2e/llm")
def llm_stats():
    return STATS


@main.app.post("/__e2e/restart")
def restart():
    init_services(settings)  # fresh registry/chain reading everything back from disk
    install_fakes()
    return {"restarted": True}


if __name__ == "__main__":
    uvicorn.run(main.app, host="127.0.0.1", port=int(os.environ.get("E2E_BACKEND_PORT", "8766")), log_level="warning")
