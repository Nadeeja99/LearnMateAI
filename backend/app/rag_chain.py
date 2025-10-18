import logging
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
# from langchain.memory import ConversationBufferMemory  # Removed for now

logger = logging.getLogger(__name__)

# Import LangFuse for tracing (optional)
try:
    from .langfuse_config import langfuse_config
except ImportError:
    langfuse_config = None

class RAGChain:
    """Handle RAG (Retrieval-Augmented Generation) operations"""
    
    def __init__(self, openai_api_key: str, vector_store):
        self.llm = ChatOpenAI(
            openai_api_key=openai_api_key,
            model_name="gpt-3.5-turbo",
            temperature=0.7,
            max_tokens=500
        )
        self.vector_store = vector_store
        # self.memory = ConversationBufferMemory(
        #     memory_key="chat_history",
        #     return_messages=True
        # )
    
    async def answer_question(self, question: str, document_names: Optional[List[str]] = None, conversation_id: str = "default") -> Dict[str, Any]:
        """Answer a question using RAG"""
        # Create LangFuse trace
        trace_context = None
        if langfuse_config and langfuse_config.is_enabled():
            trace_context = langfuse_config.create_trace(
                name="answer_question",
                input={"question": question, "document_names": document_names, "conversation_id": conversation_id}
            )
        
        # Use context manager for LangFuse tracing
        if trace_context:
            with trace_context as trace:
                try:
                    result = await self._answer_question_impl(question, document_names, conversation_id)
                    trace.update(output=result)
                    return result
                except Exception as e:
                    trace.update(output={"error": str(e)})
                    raise
        else:
            return await self._answer_question_impl(question, document_names, conversation_id)
    
    async def _answer_question_impl(self, question: str, document_names: Optional[List[str]], conversation_id: str) -> Dict[str, Any]:
        """Implementation of answer_question with optional tracing"""
        try:
            if not self.vector_store.has_documents():
                raise Exception("No documents available for answering questions")
            
            logger.info(f"Answering question: {question[:100]}...")
            if document_names:
                logger.info(f"Filtering by documents: {document_names}")
            
            # Search for relevant documents
            relevant_docs = self.vector_store.search_similar(question, k=5, document_names=document_names)
            
            if not relevant_docs:
                return {
                    "answer": "I couldn't find relevant information in the uploaded documents to answer your question.",
                    "sources": [],
                    "conversation_id": conversation_id
                }
            
            # Create context from relevant documents
            context = self._create_context_from_results(relevant_docs)
            
            # Create prompt template
            prompt_template = """Use the following pieces of context to answer the question at the end. 
            If you don't know the answer based on the context, just say that you don't know, don't try to make up an answer.
            
            Context:
            {context}
            
            Question: {question}
            
            Answer:"""
            
            prompt = PromptTemplate(
                template=prompt_template,
                input_variables=["context", "question"]
            )
            
            # Generate answer
            response = await self.llm.ainvoke([
                {"role": "user", "content": prompt.format(context=context, question=question)}
            ])
            
            answer = response.content.strip()
            
            # Extract sources
            sources = [doc["metadata"]["source"] for doc in relevant_docs]
            
            logger.info(f"Generated answer with {len(sources)} sources")
            
            return {
                "answer": answer,
                "sources": sources,
                "conversation_id": conversation_id
            }
            
        except Exception as e:
            logger.error(f"Error answering question: {e}")
            raise Exception(f"Failed to answer question: {str(e)}")
    
    async def generate_summary(self, document_names: Optional[List[str]] = None) -> str:
        """Generate a summary using RAG"""
        # Create LangFuse trace
        trace_context = None
        if langfuse_config and langfuse_config.is_enabled():
            trace_context = langfuse_config.create_trace(
                name="generate_summary",
                input={"document_names": document_names}
            )
        
        # Use context manager for LangFuse tracing
        if trace_context:
            with trace_context as trace:
                try:
                    result = await self._generate_summary_impl(document_names)
                    trace.update(output={"summary": result, "length": len(result)})
                    return result
                except Exception as e:
                    trace.update(output={"error": str(e)})
                    raise
        else:
            return await self._generate_summary_impl(document_names)
    
    async def _generate_summary_impl(self, document_names: Optional[List[str]]) -> str:
        """Implementation of generate_summary with optional tracing"""
        try:
            if not self.vector_store.has_documents():
                raise Exception("No documents available for summarization")
            
            logger.info(f"Generating summary for documents: {document_names or 'all documents'}")
            
            # Get relevant content for summarization
            relevant_docs = self.vector_store.search_similar(
                "summary overview main points key concepts important information", 
                k=20,
                document_names=document_names
            )
            
            if not relevant_docs:
                raise Exception("No suitable content found for summarization")
            
            # Create context
            context = self._create_context_from_results(relevant_docs)
            
            # Create summary prompt
            prompt = f"""Please create a comprehensive summary of the following document content.

Document Content:
{context}

Please provide:
1. A brief overview of the main topics
2. Key points and important information
3. Any notable concepts or ideas
4. Structure the summary with headings for better readability

Make the summary informative but concise, focusing on the most important information."""
            
            # Generate summary
            response = await self.llm.ainvoke([
                {"role": "user", "content": prompt}
            ])
            summary = response.content.strip()
            
            logger.info(f"Generated summary with {len(summary)} characters")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            raise Exception(f"Failed to generate summary: {str(e)}")
    
    async def generate_quiz(self, num_questions: int, difficulty: str = "medium", 
                          document_names: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Generate quiz questions using RAG"""
        # Create LangFuse trace
        trace_context = None
        if langfuse_config and langfuse_config.is_enabled():
            trace_context = langfuse_config.create_trace(
                name="generate_quiz",
                input={"num_questions": num_questions, "difficulty": difficulty, "document_names": document_names}
            )
        
        # Use context manager for LangFuse tracing
        if trace_context:
            with trace_context as trace:
                try:
                    result = await self._generate_quiz_impl(num_questions, difficulty, document_names)
                    trace.update(output={"quiz": result, "num_questions": len(result)})
                    return result
                except Exception as e:
                    trace.update(output={"error": str(e)})
                    raise
        else:
            return await self._generate_quiz_impl(num_questions, difficulty, document_names)
    
    async def _generate_quiz_impl(self, num_questions: int, difficulty: str, document_names: Optional[List[str]]) -> List[Dict[str, Any]]:
        """Implementation of generate_quiz with optional tracing"""
        try:
            if not self.vector_store.has_documents():
                raise Exception("No documents available for quiz generation")
            
            logger.info(f"Generating {num_questions} {difficulty} questions")
            if document_names:
                logger.info(f"Filtering by documents: {document_names}")
            
            # Get relevant content for quiz generation
            search_results = self.vector_store.search_similar(
                "facts concepts definitions examples important information", 
                k=20,
                document_names=document_names
            )
            
            if not search_results:
                raise Exception("No suitable content found for quiz generation")
            
            # Create context
            context = self._create_context_from_results(search_results)
            
            # Create quiz generation prompt
            prompt = self._create_quiz_prompt(context, num_questions, difficulty)
            
            # Generate quiz
            response = await self.llm.ainvoke([
                {"role": "user", "content": prompt}
            ])
            quiz_text = response.content.strip()
            
            # Parse quiz questions
            questions = self._parse_quiz_response(quiz_text)
            final_questions = questions[:num_questions]
            
            return final_questions
            
        except Exception as e:
            logger.error(f"Error generating quiz: {e}")
            raise Exception(f"Failed to generate quiz: {str(e)}")
    
    def _create_context_from_results(self, results: List[Dict]) -> str:
        """Create context string from search results"""
        context_parts = []
        for i, result in enumerate(results, 1):
            content = result["content"]
            source = result["metadata"]["source"]
            context_parts.append(f"Source {i} ({source}):\n{content}\n")
        return "\n".join(context_parts)
    
    def _create_quiz_prompt(self, context: str, num_questions: int, difficulty: str) -> str:
        """Create prompt for quiz generation"""
        return f"""Create a {difficulty} difficulty quiz with {num_questions} multiple-choice questions based on the following document content.

Document Content:
{context}

Please generate exactly {num_questions} questions. For each question, provide:
1. A clear, well-formulated question
2. 4 multiple choice options (A, B, C, D)
3. The correct answer (A, B, C, or D)
4. A brief explanation of why the answer is correct

Format your response as a JSON object with this structure:
{{
  "questions": [
    {{
      "question": "Your question here?",
      "options": {{
        "A": "First option",
        "B": "Second option", 
        "C": "Third option",
        "D": "Fourth option"
      }},
      "correct_answer": "A",
      "explanation": "Explanation of why this answer is correct"
    }}
  ]
}}

Make sure the questions test understanding of key concepts, facts, and important information from the document content."""
    
    def _parse_quiz_response(self, quiz_text: str) -> List[Dict[str, Any]]:
        """Parse quiz response from AI"""
        try:
            import json
            # Try to extract JSON from the response
            start_idx = quiz_text.find('{')
            end_idx = quiz_text.rfind('}') + 1
            
            if start_idx != -1 and end_idx != -1:
                json_str = quiz_text[start_idx:end_idx]
                quiz_data = json.loads(json_str)
                return quiz_data.get("questions", [])
            else:
                raise ValueError("No valid JSON found in response")
                
        except Exception as e:
            logger.error(f"Error parsing quiz response: {e}")
            # Return empty list if parsing fails
            return []