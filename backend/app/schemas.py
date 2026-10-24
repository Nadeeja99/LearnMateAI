"""
Structured output schemas for LLM responses
"""

from typing import List, Literal
from pydantic import BaseModel, Field

from .errors import UserFacingError


class QuizOptions(BaseModel):
    """The four multiple-choice options for a question"""
    A: str
    B: str
    C: str
    D: str


class QuizQuestion(BaseModel):
    """A single multiple-choice question"""
    question: str = Field(description="A clear, well-formulated question")
    options: QuizOptions
    correct_answer: Literal["A", "B", "C", "D"]
    explanation: str = Field(description="Why the correct answer is correct")


class Quiz(BaseModel):
    """A multiple-choice quiz generated from document content"""
    questions: List[QuizQuestion]


class QuizGenerationError(UserFacingError):
    """Raised when the model output cannot be validated as a quiz (502: the upstream model misbehaved)"""

    def __init__(self, message: str):
        super().__init__(message, status_code=502)
