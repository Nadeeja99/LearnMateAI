"""
RAG (Retrieval-Augmented Generation) chain implementation
Handles conversation memory, question answering, summarization, and quiz generation
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from langchain.chat_models import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain
from langchain.prompts import PromptTemplate
from langchain.schema import BaseRetriever

from .config import settings
from .vector_store import VectorStoreManager
from .models import QuizQuestion, DifficultyLevel

logger = logging.getLogger(__name__)

class RAGChain:
    """Handles RAG operations for question answering, summarization, and quiz generation"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            openai_api_key=settings.openai_api_key,
            model_name=settings.llm_model,
            temperature=settings.llm_temperature,
            max_tokens=settings.max_tokens
        )
        self.conversation_memories = {}  # conversation_id -> memory
        self.vector_store = None  # Will be set by main app
    
    def set_vector_store(self, vector_store: VectorStoreManager):
        """Set the vector store instance"""
        self.vector_store = vector_store
    
    async def ask_question(self, question: str, conversation_id: str) -> Tuple[str, List[str]]:
        """
        Answer a question using RAG
        
        Args:
            question: User question
            conversation_id: Conversation session ID
            
        Returns:
            Tuple[str, List[str]]: (answer, sources)
        """
        try:
            if not self.vector_store or not self.vector_store.has_documents():
                raise Exception("No documents available for answering questions")
            
            # Get conversation memory
            memory = self._get_or_create_memory(conversation_id)
            
            # Search for relevant chunks
            search_results = await self.vector_store.search_similar(question)
            
            if not search_results:
                return "I couldn't find relevant information in the uploaded documents to answer your question.", []
            
            # Create context from search results
            context = self._create_context_from_results(search_results)
            sources = [result.content[:200] + "..." for result in search_results]
            
            # Create prompt for question answering
            prompt = self._create_qa_prompt(context, question)
            
            # Generate answer
            response = await self.llm.agenerate([prompt])
            answer = response.generations[0][0].text.strip()
            
            # Store in conversation memory
            memory.save_context({"input": question}, {"output": answer})
            
            return answer, sources
            
        except Exception as e:
            logger.error(f"Error answering question: {e}")
            raise Exception(f"Failed to answer question: {str(e)}")
    
    async def generate_summary(self, document_name: Optional[str] = None) -> str:
        """
        Generate a summary of documents
        
        Args:
            document_name: Specific document to summarize (optional)
            
        Returns:
            str: Generated summary
        """
        try:
            if not self.vector_store or not self.vector_store.has_documents():
                raise Exception("No documents available for summarization")
            
            # Get all documents or specific document
            if document_name:
                # Get chunks for specific document
                search_results = await self.vector_store.search_similar(
                    "summary overview main topics key points", k=20
                )
                search_results = [r for r in search_results if r.source_document == document_name]
            else:
                # Get chunks from all documents
                search_results = await self.vector_store.search_similar(
                    "summary overview main topics key points", k=30
                )
            
            if not search_results:
                return "No content found to summarize."
            
            # Create context
            context = self._create_context_from_results(search_results)
            
            # Create summarization prompt
            prompt = self._create_summary_prompt(context, document_name)
            
            # Generate summary
            response = await self.llm.agenerate([prompt])
            summary = response.generations[0][0].text.strip()
            
            return summary
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            raise Exception(f"Failed to generate summary: {str(e)}")
    
    async def generate_quiz(self, num_questions: int, difficulty: DifficultyLevel, 
                          document_name: Optional[str] = None) -> List[QuizQuestion]:
        """
        Generate quiz questions from documents
        
        Args:
            num_questions: Number of questions to generate
            difficulty: Difficulty level
            document_name: Specific document for quiz (optional)
            
        Returns:
            List[QuizQuestion]: Generated quiz questions
        """
        try:
            if not self.vector_store or not self.vector_store.has_documents():
                raise Exception("No documents available for quiz generation")
            
            # Get relevant content for quiz generation
            search_results = await self.vector_store.search_similar(
                "facts concepts definitions examples important information", k=20
            )
            
            if document_name:
                search_results = [r for r in search_results if r.source_document == document_name]
            
            if not search_results:
                raise Exception("No suitable content found for quiz generation")
            
            # Create context
            context = self._create_context_from_results(search_results)
            
            # Create quiz generation prompt
            prompt = self._create_quiz_prompt(context, num_questions, difficulty)
            
            # Generate quiz
            response = await self.llm.agenerate([prompt])
            quiz_text = response.generations[0][0].text.strip()
            
            # Parse quiz questions
            questions = self._parse_quiz_response(quiz_text)
            
            return questions[:num_questions]
            
        except Exception as e:
            logger.error(f"Error generating quiz: {e}")
            raise Exception(f"Failed to generate quiz: {str(e)}")
    
    def _get_or_create_memory(self, conversation_id: str) -> ConversationBufferMemory:
        """Get or create conversation memory for session"""
        if conversation_id not in self.conversation_memories:
            self.conversation_memories[conversation_id] = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True
            )
        return self.conversation_memories[conversation_id]
    
    def _create_context_from_results(self, results: List) -> str:
        """Create context string from search results"""
        context_parts = []
        for i, result in enumerate(results, 1):
            context_parts.append(f"Source {i} (from {result.source_document}):\n{result.content}\n")
        return "\n".join(context_parts)
    
    def _create_qa_prompt(self, context: str, question: str) -> str:
        """Create prompt for question answering"""
        return f"""You are a helpful AI assistant that answers questions based on the provided document content.

Context from documents:
{context}

Question: {question}

Instructions:
- Answer the question based only on the information provided in the context above
- If the context doesn't contain enough information to answer the question, say so
- Be specific and cite relevant parts of the documents when possible
- Keep your answer concise but comprehensive
- If you're unsure about something, express that uncertainty

Answer:"""
    
    def _create_summary_prompt(self, context: str, document_name: Optional[str] = None) -> str:
        """Create prompt for document summarization"""
        doc_ref = f" for the document '{document_name}'" if document_name else " for all uploaded documents"
        
        return f"""You are an expert at creating comprehensive summaries of educational content.

Content{doc_ref}:
{context}

Instructions:
- Create a well-structured summary with clear headings
- Identify the main topics and key concepts
- Include important details and examples
- Organize the information logically
- Use markdown formatting for better readability
- Keep the summary comprehensive but concise

Summary:"""
    
    def _create_quiz_prompt(self, context: str, num_questions: int, difficulty: DifficultyLevel) -> str:
        """Create prompt for quiz generation"""
        difficulty_instructions = {
            DifficultyLevel.EASY: "Create simple, straightforward questions that test basic understanding",
            DifficultyLevel.MEDIUM: "Create questions that require some analysis and application of concepts",
            DifficultyLevel.HARD: "Create challenging questions that require deep understanding and critical thinking"
        }
        
        return f"""You are an expert at creating educational quiz questions.

Content to create questions from:
{context}

Instructions:
- Create {num_questions} multiple-choice questions
- Difficulty level: {difficulty.value} - {difficulty_instructions[difficulty]}
- Each question should have 4 options (A, B, C, D)
- Include one correct answer and three plausible distractors
- Provide a brief explanation for the correct answer
- Base questions only on the provided content
- Format each question as follows:

Question 1: [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [A/B/C/D]
Explanation: [Brief explanation]

Quiz Questions:"""
    
    def _parse_quiz_response(self, quiz_text: str) -> List[QuizQuestion]:
        """Parse quiz response into QuizQuestion objects"""
        questions = []
        try:
            # Split by question markers
            question_blocks = quiz_text.split("Question ")
            
            for block in question_blocks[1:]:  # Skip first empty block
                lines = [line.strip() for line in block.split("\n") if line.strip()]
                
                if len(lines) < 6:  # Minimum lines for a complete question
                    continue
                
                # Extract question text
                question_text = lines[0]
                
                # Extract options
                options = {}
                correct_answer = None
                explanation = ""
                
                for line in lines[1:]:
                    if line.startswith(("A)", "B)", "C)", "D)")):
                        option_key = line[0]
                        option_text = line[2:].strip()
                        options[option_key] = option_text
                    elif line.startswith("Correct Answer:"):
                        correct_answer = line.split(":")[1].strip()
                    elif line.startswith("Explanation:"):
                        explanation = line.split(":", 1)[1].strip()
                
                if len(options) == 4 and correct_answer and explanation:
                    question = QuizQuestion(
                        question=question_text,
                        options=options,
                        correct_answer=correct_answer,
                        explanation=explanation
                    )
                    questions.append(question)
            
        except Exception as e:
            logger.error(f"Error parsing quiz response: {e}")
        
        return questions
    
    async def clear_memory(self, conversation_id: Optional[str] = None):
        """Clear conversation memory"""
        try:
            if conversation_id:
                if conversation_id in self.conversation_memories:
                    del self.conversation_memories[conversation_id]
                    logger.info(f"Cleared memory for conversation {conversation_id}")
            else:
                self.conversation_memories.clear()
                logger.info("Cleared all conversation memories")
                
        except Exception as e:
            logger.error(f"Error clearing memory: {e}")
            raise
    
    def get_conversation_history(self, conversation_id: str) -> List[Dict[str, str]]:
        """Get conversation history for a session"""
        try:
            if conversation_id not in self.conversation_memories:
                return []
            
            memory = self.conversation_memories[conversation_id]
            history = []
            
            for message in memory.chat_memory.messages:
                if hasattr(message, 'content'):
                    history.append({
                        "role": message.__class__.__name__.lower().replace("message", ""),
                        "content": message.content
                    })
            
            return history
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []
