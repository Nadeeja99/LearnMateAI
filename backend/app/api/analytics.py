"""Learning analytics: per-session progress (private) and anonymous global aggregates."""

from typing import Optional

from fastapi import APIRouter, Depends

from ..errors import internal_error
from ..models import FeedbackRequest, TrackQuizRequest
from ..services import services
from ..sessions import require_session_id
from .deps import require_own_conversation, require_self

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/user/{user_id}")
async def get_user_analytics(user_id: str, session_id: str = Depends(require_session_id)):
    """Get comprehensive analytics for a user (only the caller's own)"""
    require_self(user_id, session_id)
    try:
        return services.analytics.get_user_analytics(user_id)
    except Exception:
        raise internal_error("Loading analytics")


@router.get("/global")
async def get_global_analytics():
    """Get global analytics across all users"""
    try:
        return services.analytics.get_global_analytics()
    except Exception:
        raise internal_error("Loading analytics")


@router.get("/performance-metrics")
async def get_performance_metrics(metric_name: Optional[str] = None, days: int = 30):
    """Get performance metrics"""
    try:
        return {"metrics": services.analytics.get_performance_metrics(metric_name, days), "metric_name": metric_name, "days": days}
    except Exception:
        raise internal_error("Loading performance metrics")


@router.post("/feedback")
async def record_feedback(body: FeedbackRequest, session_id: str = Depends(require_session_id)):
    """Thumbs up/down on an AI answer, recorded as an `answer_feedback` metric (+1 / -1)"""
    if body.conversation_id:
        require_own_conversation(body.conversation_id, session_id)
    try:
        services.analytics.add_performance_metric(
            metric_name="answer_feedback",
            value=1 if body.rating == "up" else -1,
            context={"rating": body.rating, "model": body.model},
        )
        return {"message": "Thanks for the feedback"}
    except Exception:
        raise internal_error("Recording feedback")


@router.post("/track-quiz")
async def track_quiz_completion(body: TrackQuizRequest, session_id: str = Depends(require_session_id)):
    """Track quiz completion analytics"""
    try:
        services.analytics.track_session(
            user_id=session_id,
            session_type="quiz",
            metadata={
                "quiz_score": body.quiz_score,
                "total_questions": body.total_questions,
                "score_percentage": body.score_percentage,
                "completed_at": body.completed_at,
            },
        )
        services.analytics.add_performance_metric(
            metric_name="quiz_score_percentage",
            value=body.score_percentage,
            context={"quiz_score": body.quiz_score, "total_questions": body.total_questions},
        )
        return {"message": "Quiz completion tracked successfully"}
    except Exception:
        raise internal_error("Recording the quiz result")
