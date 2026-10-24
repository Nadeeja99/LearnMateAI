"""
Request body models. FastAPI validates every request against these before a handler runs,
replacing the untyped `dict` bodies and their hand-written checks.
"""

from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

DocumentName = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class RequestModel(BaseModel):
    # Older clients send extra fields such as user_id; identity comes from X-Session-Id instead
    model_config = ConfigDict(extra="ignore")


class AskRequest(RequestModel):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]
    conversation_id: str = Field("default", max_length=100)


class SummaryRequest(RequestModel):
    document_name: Optional[DocumentName] = None


class QuizRequest(RequestModel):
    num_questions: int = Field(5, ge=1, le=20)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    document_name: Optional[DocumentName] = None


class CreateConversationRequest(RequestModel):
    title: Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]] = None
    document_context: List[DocumentName] = Field(default_factory=list, max_length=100)


class FeedbackRequest(RequestModel):
    rating: Literal["up", "down"]
    conversation_id: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)


# Human-readable names for validation messages ("Number of questions: ..." not "num_questions: ...")
FIELD_LABELS = {
    "question": "Question",
    "conversation_id": "Conversation",
    "document_name": "Document",
    "num_questions": "Number of questions",
    "difficulty": "Difficulty",
    "title": "Title",
    "document_context": "Documents",
    "rating": "Rating",
    "quiz_score": "Quiz score",
    "total_questions": "Total questions",
    "score_percentage": "Score",
}


class TrackQuizRequest(RequestModel):
    quiz_score: int = Field(0, ge=0)
    total_questions: int = Field(1, ge=1, le=100)
    score_percentage: float = Field(0, ge=0, le=100)
    completed_at: Optional[str] = Field(None, max_length=50)
