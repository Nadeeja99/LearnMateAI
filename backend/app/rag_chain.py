import asyncio
import copy
import json
import logging
import os
import time
from contextlib import aclosing
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, AsyncIterator, Awaitable, Callable

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from .schemas import Quiz, QuizGenerationError

logger = logging.getLogger(__name__)

# Import LangFuse for tracing (optional)
try:
    from .langfuse_config import langfuse_config
except ImportError:
    langfuse_config = None

# Import conversation memory and analytics
try:
    from .conversation_memory import conversation_memory
    from .learning_analytics import learning_analytics
except ImportError:
    conversation_memory = None
    learning_analytics = None

DEFAULT_CHAT_MODEL = "gpt-5.4-mini"
NO_CONTEXT_ANSWER = "I couldn't find relevant information in the uploaded documents to answer your question."
SUMMARY_QUERY = "summary overview main points key concepts important information"
QUIZ_QUERY = "facts concepts definitions examples important information"
SOURCE_PREVIEW_CHARS = 280


@dataclass
class GenerationStats:
    """Timing and token usage collected while a completion runs"""
    started_at: float = field(default_factory=time.perf_counter)
    first_token_at: Optional[float] = None
    finished_at: Optional[float] = None
    parts: List[str] = field(default_factory=list)
    usage: Optional[Dict[str, Any]] = None
    finish_reason: Optional[str] = None

    @property
    def text(self) -> str:
        return "".join(self.parts).strip()


class RAGChain:
    """Handle RAG (Retrieval-Augmented Generation) operations"""

    def __init__(self, openai_api_key: str, vector_store):
        self.model_name = os.getenv("OPENAI_CHAT_MODEL", DEFAULT_CHAT_MODEL)
        self.llm = self._make_llm(openai_api_key, int(os.getenv("OPENAI_MAX_TOKENS", "500")))
        self.summary_llm = self._make_llm(openai_api_key, int(os.getenv("OPENAI_SUMMARY_MAX_TOKENS", "1500")))
        # 20 questions with explanations need far more than the chat budget
        self.quiz_llm = self._make_llm(openai_api_key, int(os.getenv("OPENAI_QUIZ_MAX_TOKENS", "3500")))
        self.vector_store = vector_store

    def with_store(self, vector_store) -> "RAGChain":
        """A shallow copy bound to another vector store (e.g. one session's index); LLM clients are shared"""
        bound = copy.copy(self)
        bound.vector_store = vector_store
        return bound

    def _make_llm(self, openai_api_key: str, max_tokens: int) -> ChatOpenAI:
        return ChatOpenAI(
            api_key=openai_api_key,
            model=self.model_name,
            temperature=0.7,
            max_tokens=max_tokens,
            stream_usage=True,
        )

    # ===== Question answering =====

    async def answer_question(self, question: str, document_names: Optional[List[str]] = None,
                             conversation_id: str = "default", user_id: str = "default") -> Dict[str, Any]:
        """Answer a question using RAG"""
        return await self._traced(
            "answer_question",
            {"question": question, "document_names": document_names, "conversation_id": conversation_id},
            lambda: self._answer_question_impl(question, document_names, conversation_id, user_id),
        )

    async def _answer_question_impl(self, question: str, document_names: Optional[List[str]], conversation_id: str, user_id: str) -> Dict[str, Any]:
        """Implementation of answer_question with optional tracing"""
        try:
            if not self.vector_store.has_documents():
                raise Exception("No documents available for answering questions")

            logger.info(f"Answering question: {question[:100]}...")
            request_started = time.perf_counter()
            history = self._conversation_history(conversation_id)
            relevant_docs, retrieval_ms = await self._retrieve(question, 5, document_names)

            if not relevant_docs:
                return {"answer": NO_CONTEXT_ANSWER, "sources": [], "conversation_id": conversation_id}

            context = self._create_context_from_results(relevant_docs)
            prompt = self._build_answer_prompt(question, context, history)
            stats = await self._invoke_llm(self.llm, prompt)
            answer = stats.text

            sources = self._source_metadata(relevant_docs)
            telemetry = self._build_telemetry(prompt, stats, request_started, retrieval_ms, sources)
            self._record_answer(conversation_id, user_id, question, answer, document_names, len(context), telemetry)

            return {
                "answer": answer,
                "sources": [s["source"] for s in sources],
                "conversation_id": conversation_id,
                "telemetry": telemetry,
            }

        except Exception as e:
            logger.error(f"Error answering question: {e}")
            raise Exception(f"Failed to answer question: {str(e)}")

    def stream_answer(self, question: str, document_names: Optional[List[str]] = None,
                      conversation_id: str = "default", user_id: str = "default") -> AsyncIterator[Dict[str, Any]]:
        """Stream an answer as events: meta, token*, done"""
        return self._stream_traced(
            "answer_question_stream",
            {"question": question, "document_names": document_names, "conversation_id": conversation_id},
            self._stream_answer_impl(question, document_names, conversation_id, user_id),
        )

    async def _stream_answer_impl(self, question: str, document_names: Optional[List[str]],
                                  conversation_id: str, user_id: str) -> AsyncIterator[Dict[str, Any]]:
        request_started = time.perf_counter()
        history = self._conversation_history(conversation_id)
        relevant_docs, retrieval_ms = await self._retrieve(question, 5, document_names)
        sources = self._source_metadata(relevant_docs)
        yield {"type": "meta", "model": self.model_name, "retrieval_ms": round(retrieval_ms, 1), "sources": sources}

        if not relevant_docs:
            stats = GenerationStats(parts=[NO_CONTEXT_ANSWER], finished_at=time.perf_counter())
            yield {"type": "token", "content": NO_CONTEXT_ANSWER}
            yield {
                "type": "done",
                "conversation_id": conversation_id,
                "telemetry": self._build_telemetry(None, stats, request_started, retrieval_ms, sources),
            }
            return

        context = self._create_context_from_results(relevant_docs)
        prompt = self._build_answer_prompt(question, context, history)
        stats = GenerationStats()
        async with aclosing(self._stream_llm(self.llm, prompt, stats)) as tokens:
            async for event in tokens:
                yield event

        telemetry = self._build_telemetry(prompt, stats, request_started, retrieval_ms, sources)
        self._record_answer(conversation_id, user_id, question, stats.text, document_names, len(context), telemetry)
        yield {"type": "done", "conversation_id": conversation_id, "telemetry": telemetry}

    # ===== Summaries =====

    async def generate_summary(self, document_names: Optional[List[str]] = None, user_id: str = "default") -> str:
        """Generate a summary using RAG"""
        return await self._traced(
            "generate_summary",
            {"document_names": document_names},
            lambda: self._generate_summary_impl(document_names, user_id),
            lambda summary: {"summary": summary, "length": len(summary)},
        )

    async def _generate_summary_impl(self, document_names: Optional[List[str]], user_id: str) -> str:
        """Implementation of generate_summary with optional tracing"""
        try:
            if not self.vector_store.has_documents():
                raise Exception("No documents available for summarization")

            logger.info(f"Generating summary for documents: {document_names or 'all documents'}")
            relevant_docs, _ = await self._retrieve(SUMMARY_QUERY, 20, document_names)
            if not relevant_docs:
                raise Exception("No suitable content found for summarization")

            context = self._create_context_from_results(relevant_docs)
            stats = await self._invoke_llm(self.summary_llm, self._build_summary_prompt(context))
            summary = stats.text

            logger.info(f"Generated summary with {len(summary)} characters")
            self._record_summary(user_id, document_names, summary, len(context))
            return summary

        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            raise Exception(f"Failed to generate summary: {str(e)}")

    def stream_summary(self, document_names: Optional[List[str]] = None,
                       user_id: str = "default") -> AsyncIterator[Dict[str, Any]]:
        """Stream a summary as events: meta, token*, done"""
        return self._stream_traced(
            "generate_summary_stream",
            {"document_names": document_names},
            self._stream_summary_impl(document_names, user_id),
        )

    async def _stream_summary_impl(self, document_names: Optional[List[str]], user_id: str) -> AsyncIterator[Dict[str, Any]]:
        request_started = time.perf_counter()
        relevant_docs, retrieval_ms = await self._retrieve(SUMMARY_QUERY, 20, document_names)
        if not relevant_docs:
            raise ValueError("No suitable content found for summarization")

        sources = self._source_metadata(relevant_docs)
        yield {"type": "meta", "model": self.model_name, "retrieval_ms": round(retrieval_ms, 1), "sources": sources}

        context = self._create_context_from_results(relevant_docs)
        prompt = self._build_summary_prompt(context)
        stats = GenerationStats()
        async with aclosing(self._stream_llm(self.summary_llm, prompt, stats)) as tokens:
            async for event in tokens:
                yield event

        self._record_summary(user_id, document_names, stats.text, len(context))
        yield {"type": "done", "telemetry": self._build_telemetry(prompt, stats, request_started, retrieval_ms, sources)}

    # ===== Quizzes =====

    async def generate_quiz(self, num_questions: int, difficulty: str = "medium",
                          document_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """Generate schema-validated quiz questions using RAG.

        Returns {"questions": [...], "telemetry": {...}}.
        """
        return await self._traced(
            "generate_quiz",
            {"num_questions": num_questions, "difficulty": difficulty, "document_names": document_names},
            lambda: self._generate_quiz_impl(num_questions, difficulty, document_names),
            lambda result: {"quiz": result["questions"], "num_questions": len(result["questions"])},
        )

    async def _generate_quiz_impl(self, num_questions: int, difficulty: str, document_names: Optional[List[str]]) -> Dict[str, Any]:
        """Implementation of generate_quiz with optional tracing"""
        try:
            if not self.vector_store.has_documents():
                raise Exception("No documents available for quiz generation")

            logger.info(f"Generating {num_questions} {difficulty} questions")
            request_started = time.perf_counter()
            search_results, retrieval_ms = await self._retrieve(QUIZ_QUERY, 20, document_names)
            if not search_results:
                raise Exception("No suitable content found for quiz generation")

            context = self._create_context_from_results(search_results)
            prompt = self._create_quiz_prompt(context, num_questions, difficulty)

            # Function calling works on every chat model, unlike json_schema mode
            structured_llm = self.quiz_llm.with_structured_output(Quiz, method="function_calling", include_raw=True)
            stats = GenerationStats()
            result = await structured_llm.ainvoke([HumanMessage(content=prompt)])
            stats.finished_at = time.perf_counter()

            raw, parsed = result.get("raw"), result.get("parsed")
            stats.usage = getattr(raw, "usage_metadata", None)
            if parsed is None or not parsed.questions:
                logger.error(f"Quiz failed schema validation: {result.get('parsing_error')}")
                raise QuizGenerationError("The model returned a quiz that failed validation. Please try again.")

            questions = [q.model_dump() for q in parsed.questions[:num_questions]]
            stats.parts = [json.dumps(questions)]

            telemetry = self._build_telemetry(prompt, stats, request_started, retrieval_ms, self._source_metadata(search_results))
            telemetry["structured_output"] = {
                "schema": "Quiz",
                "method": "function_calling",
                "validated": True,
                "items": len(questions),
            }
            return {"questions": questions, "telemetry": telemetry}

        except QuizGenerationError:
            raise
        except Exception as e:
            logger.error(f"Error generating quiz: {e}")
            raise Exception(f"Failed to generate quiz: {str(e)}")

    # ===== LLM execution & telemetry =====

    async def _stream_llm(self, llm, prompt: str, stats: GenerationStats) -> AsyncIterator[Dict[str, Any]]:
        """Stream token events from the LLM, recording timing and usage into stats"""
        stats.started_at = time.perf_counter()
        async for chunk in llm.astream([HumanMessage(content=prompt)]):
            if isinstance(chunk.content, str) and chunk.content:
                if stats.first_token_at is None:
                    stats.first_token_at = time.perf_counter()
                stats.parts.append(chunk.content)
                yield {"type": "token", "content": chunk.content}
            if getattr(chunk, "usage_metadata", None):
                stats.usage = chunk.usage_metadata
            finish_reason = (getattr(chunk, "response_metadata", None) or {}).get("finish_reason")
            if finish_reason:
                stats.finish_reason = finish_reason
        stats.finished_at = time.perf_counter()

    async def _invoke_llm(self, llm, prompt: str) -> GenerationStats:
        """Run a single non-streaming completion and collect its stats"""
        stats = GenerationStats()
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        stats.finished_at = time.perf_counter()
        stats.parts = [response.content]
        stats.usage = getattr(response, "usage_metadata", None)
        stats.finish_reason = (getattr(response, "response_metadata", None) or {}).get("finish_reason")
        return stats

    def _build_telemetry(self, prompt: Optional[str], stats: GenerationStats, request_started: float,
                         retrieval_ms: float, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assemble the telemetry payload shown in the frontend inspector.

        prompt is None when no LLM call was made (e.g. nothing was retrieved).
        """
        finished_at = stats.finished_at or time.perf_counter()
        usage = self._normalise_usage(stats.usage, prompt, stats.text)

        ttft_ms = None
        tokens_per_second = None
        if stats.first_token_at is not None:
            ttft_ms = round((stats.first_token_at - request_started) * 1000, 1)
            streaming_seconds = finished_at - stats.first_token_at
            if streaming_seconds > 0 and usage["output_tokens"]:
                tokens_per_second = round(usage["output_tokens"] / streaming_seconds, 1)

        return {
            "model": self.model_name,
            "ttft_ms": ttft_ms,
            "retrieval_ms": round(retrieval_ms, 1),
            "generation_ms": round((finished_at - stats.started_at) * 1000, 1) if prompt is not None else 0.0,
            "total_ms": round((finished_at - request_started) * 1000, 1),
            "tokens_per_second": tokens_per_second,
            "finish_reason": stats.finish_reason,
            "usage": usage,
            "system_prompt": prompt,
            "sources": sources,
        }

    @staticmethod
    def _normalise_usage(usage: Optional[Dict[str, Any]], prompt: Optional[str], completion: str) -> Dict[str, Any]:
        if prompt is None:
            return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "estimated": False}
        if usage and usage.get("total_tokens"):
            return {
                "input_tokens": int(usage.get("input_tokens", 0)),
                "output_tokens": int(usage.get("output_tokens", 0)),
                "total_tokens": int(usage.get("total_tokens", 0)),
                "estimated": False,
            }
        # Provider omitted usage: fall back to the ~4 characters per token heuristic
        input_tokens, output_tokens = len(prompt) // 4, len(completion) // 4
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "estimated": True,
        }

    async def _traced(self, name: str, trace_input: Dict[str, Any], run: Callable[[], Awaitable[Any]],
                      summarize: Callable[[Any], Any] = lambda result: result) -> Any:
        """Run a coroutine inside a LangFuse trace when tracing is enabled"""
        trace_context = None
        if langfuse_config and langfuse_config.is_enabled():
            trace_context = langfuse_config.create_trace(name=name, input=trace_input)

        if not trace_context:
            return await run()

        with trace_context as trace:
            try:
                result = await run()
                trace.update(output=summarize(result))
                return result
            except Exception as e:
                trace.update(output={"error": str(e)})
                raise

    async def _stream_traced(self, name: str, trace_input: Dict[str, Any],
                             events: AsyncIterator[Dict[str, Any]]) -> AsyncIterator[Dict[str, Any]]:
        """Wrap an event stream in a detached LangFuse span, closing it on completion or abort"""
        span = langfuse_config.start_span(name=name, input=trace_input) if langfuse_config else None
        async with aclosing(events) as stream:
            try:
                async for event in stream:
                    if span and event["type"] == "done":
                        telemetry = {k: v for k, v in event["telemetry"].items() if k != "system_prompt"}
                        span.update(output={"telemetry": telemetry})
                    yield event
            except BaseException as e:
                # Includes GeneratorExit/CancelledError when the client aborts
                if span:
                    span.update(output={"error": repr(e)})
                raise
            finally:
                if span:
                    span.end()

    # ===== Retrieval, prompts & persistence =====

    async def _retrieve(self, query: str, k: int, document_names: Optional[List[str]]):
        """Similarity search off the event loop; returns (results, elapsed_ms)"""
        started = time.perf_counter()
        results = await asyncio.to_thread(self.vector_store.search_similar, query, k, document_names)
        return results, (time.perf_counter() - started) * 1000

    @staticmethod
    def _source_metadata(results: List[Dict]) -> List[Dict[str, Any]]:
        """Chunk-level metadata for the context inspector (distance: lower is closer)"""
        return [
            {
                "rank": rank,
                "source": result["metadata"].get("source", "unknown"),
                "distance": round(float(result.get("score", 0.0)), 4),
                "characters": len(result["content"]),
                "preview": result["content"][:SOURCE_PREVIEW_CHARS],
            }
            for rank, result in enumerate(results, 1)
        ]

    def _conversation_history(self, conversation_id: str) -> List[Dict[str, Any]]:
        if conversation_memory and conversation_id != "default":
            return conversation_memory.get_conversation_history(conversation_id, limit=5)
        return []

    def _record_answer(self, conversation_id: str, user_id: str, question: str, answer: str,
                       document_names: Optional[List[str]], context_length: int, telemetry: Dict[str, Any]) -> None:
        """Persist the exchange to conversation memory and analytics"""
        sources = [s["source"] for s in telemetry["sources"]]
        stored_telemetry = {k: v for k, v in telemetry.items() if k != "system_prompt"}

        # "default" means no conversation was created, so there is nothing to append to
        if conversation_memory and conversation_id != "default":
            conversation_memory.add_message(conversation_id, "user", question, {"document_names": document_names})
            conversation_memory.add_message(
                conversation_id,
                "assistant",
                answer,
                {"sources": sources, "context_length": context_length, "telemetry": stored_telemetry},
            )

        if learning_analytics:
            learning_analytics.track_session(
                user_id=user_id,
                session_type="chat",
                document_name=document_names[0] if document_names else None,
                duration_seconds=0,
                metadata={
                    "question_length": len(question),
                    "answer_length": len(answer),
                    "sources_count": len(sources),
                    "conversation_id": conversation_id,
                },
            )
            if telemetry["ttft_ms"] is not None:
                learning_analytics.add_performance_metric(
                    metric_name="llm_ttft_ms",
                    value=telemetry["ttft_ms"],
                    context={"model": telemetry["model"], "total_tokens": telemetry["usage"]["total_tokens"]},
                )

    def _record_summary(self, user_id: str, document_names: Optional[List[str]], summary: str, context_length: int) -> None:
        if learning_analytics:
            learning_analytics.track_session(
                user_id=user_id,
                session_type="summary",
                document_name=document_names[0] if document_names else None,
                duration_seconds=0,
                metadata={
                    "summary_length": len(summary),
                    "document_count": len(document_names) if document_names else 0,
                    "context_length": context_length,
                },
            )

    def _create_context_from_results(self, results: List[Dict]) -> str:
        """Create context string from search results"""
        context_parts = []
        for i, result in enumerate(results, 1):
            content = result["content"]
            source = result["metadata"]["source"]
            context_parts.append(f"Source {i} ({source}):\n{content}\n")
        return "\n".join(context_parts)

    @staticmethod
    def _build_answer_prompt(question: str, context: str, history: List[Dict[str, Any]]) -> str:
        conversation_context = ""
        if history:
            lines = [
                f"{'Human' if msg['role'] == 'user' else 'Assistant'}: {msg['content']}"
                for msg in history[-3:]  # Last 3 messages for context
            ]
            conversation_context = "\n\nPrevious conversation:\n" + "\n".join(lines)

        return f"""Use the following pieces of context and conversation history to answer the question at the end.
If you don't know the answer based on the context, just say that you don't know, don't try to make up an answer.
Consider the conversation history to provide contextually relevant responses.
Format the answer in Markdown when it aids readability (lists, tables, **bold** key terms). Put any code in fenced code blocks with a language tag.

Context:
{context}{conversation_context}

Question: {question}

Answer:"""

    @staticmethod
    def _build_summary_prompt(context: str) -> str:
        return f"""Please create a comprehensive summary of the following document content.

Document Content:
{context}

Format the summary in Markdown:
1. Open with a short overview paragraph of the main topics
2. Use `##` headings for each major theme, with bullet points for key points and important information
3. Finish with a `## Key Takeaways` section
4. Bold the most important concepts

Make the summary informative but concise, focusing on the most important information."""

    def _create_quiz_prompt(self, context: str, num_questions: int, difficulty: str) -> str:
        """Create prompt for quiz generation"""
        return f"""Create a {difficulty} difficulty quiz with exactly {num_questions} multiple-choice questions based on the following document content.

Document Content:
{context}

For each question provide a clear question, four options labelled A-D, the letter of the correct answer, and a brief explanation of why it is correct.
Make sure the questions test understanding of key concepts, facts, and important information from the document content."""
