"""AI endpoints: question answering, summaries and quizzes (rate limited; they cost money)."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..errors import UserFacingError, internal_error, new_error_ref
from ..models import AskRequest, QuizRequest, SummaryRequest
from ..rate_limit import ai_rate_limited
from ..services import services
from .deps import require_documents, require_own_conversation, session_documents

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai"])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _event_stream(events, label: str) -> StreamingResponse:
    """Serialize RAG events as Server-Sent Events.

    If the client disconnects, Starlette cancels this generator, which closes the
    upstream LLM stream so generation stops server-side too.
    """
    async def generate():
        try:
            async for event in events:
                yield _sse(event["type"], event)
        except UserFacingError as e:
            yield _sse("error", {"type": "error", "message": e.message})
        except Exception:
            ref = new_error_ref()
            logger.exception(f"{label} stream failed [ref {ref}]")
            yield _sse("error", {"type": "error", "message": f"{label} failed. Please try again. (ref {ref})"})

    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/ask")
async def ask_question(body: AskRequest, session_id: str = Depends(ai_rate_limited)):
    """Ask a question using RAG system"""
    try:
        store = services.store(session_id)
        require_documents(store)
        require_own_conversation(body.conversation_id, session_id)
        logger.info(f"Processing question: {body.question[:100]}...")
        return await services.chain(session_id).answer_question(
            question=body.question,
            document_names=session_documents(store),
            conversation_id=body.conversation_id,
            user_id=session_id,
        )
    except HTTPException:
        raise
    except Exception:
        raise internal_error("Answering the question")


@router.post("/ask/stream")
async def ask_question_stream(body: AskRequest, session_id: str = Depends(ai_rate_limited)):
    """Stream an answer as SSE events: meta, token*, done (or error)"""
    store = services.store(session_id)
    require_documents(store)
    require_own_conversation(body.conversation_id, session_id)
    logger.info(f"Streaming answer for: {body.question[:100]}...")
    events = services.chain(session_id).stream_answer(
        question=body.question,
        document_names=session_documents(store),
        conversation_id=body.conversation_id,
        user_id=session_id,
    )
    return _event_stream(events, "Answer generation")


@router.post("/summarize")
async def generate_summary(body: SummaryRequest, session_id: str = Depends(ai_rate_limited)):
    """Generate a summary using RAG system"""
    try:
        store = services.store(session_id)
        require_documents(store)
        summary_docs = session_documents(store, body.document_name)
        logger.info(f"Generating summary for: {summary_docs or 'all documents'}")
        summary = await services.chain(session_id).generate_summary(summary_docs, user_id=session_id)
        return {"summary": summary, "document_name": body.document_name or "all_documents", "generated_at": datetime.now().isoformat()}
    except HTTPException:
        raise
    except Exception:
        raise internal_error("Generating the summary")


@router.post("/summarize/stream")
async def generate_summary_stream(body: SummaryRequest, session_id: str = Depends(ai_rate_limited)):
    """Stream a Markdown summary as SSE events: meta, token*, done (or error)"""
    store = services.store(session_id)
    require_documents(store)
    summary_docs = session_documents(store, body.document_name)
    logger.info(f"Streaming summary for: {summary_docs or 'all documents'}")
    return _event_stream(services.chain(session_id).stream_summary(summary_docs, user_id=session_id), "Summary generation")


@router.post("/generate-quiz")
async def generate_quiz(body: QuizRequest, session_id: str = Depends(ai_rate_limited)):
    """Generate a schema-validated quiz using RAG system"""
    try:
        store = services.store(session_id)
        require_documents(store)
        quiz_docs = session_documents(store, body.document_name)
        logger.info(f"Generating {body.num_questions} {body.difficulty} questions from {quiz_docs}")
        result = await services.chain(session_id).generate_quiz(body.num_questions, body.difficulty, quiz_docs)
        questions = result["questions"]
        return {
            "quiz": questions,
            "total_questions": len(questions),
            "telemetry": result["telemetry"],
            "difficulty": body.difficulty,
            "document_name": body.document_name or "all_documents",
            "generated_at": datetime.now().isoformat(),
        }
    except HTTPException:  # includes QuizGenerationError (502)
        raise
    except Exception:
        raise internal_error("Generating the quiz")
