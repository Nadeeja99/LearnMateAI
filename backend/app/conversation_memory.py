"""
Conversation Memory System for LearnMate AI
Provides persistent conversation history and context awareness
"""

import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)

@dataclass
class Message:
    """Individual message in a conversation"""
    id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime
    metadata: Dict[str, Any] = None

@dataclass
class Conversation:
    """Complete conversation session"""
    id: str
    user_id: str
    title: str
    messages: List[Message]
    created_at: datetime
    updated_at: datetime
    document_context: List[str] = None  # Documents used in this conversation
    summary: str = None  # AI-generated conversation summary

class ConversationMemory:
    """Manages conversation memory and context"""
    
    def __init__(self, storage_dir: str = "data/conversations"):
        self.storage_dir = storage_dir
        self.conversations: Dict[str, Conversation] = {}
        self._ensure_storage_dir()
        self._load_conversations()
    
    def _ensure_storage_dir(self):
        """Ensure storage directory exists"""
        os.makedirs(self.storage_dir, exist_ok=True)
    
    def _load_conversations(self):
        """Load conversations from storage"""
        try:
            conversations_file = os.path.join(self.storage_dir, "conversations.json")
            if os.path.exists(conversations_file):
                with open(conversations_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for conv_id, conv_data in data.items():
                        # Convert message timestamps back to datetime objects
                        messages = []
                        for msg_data in conv_data['messages']:
                            msg = Message(
                                id=msg_data['id'],
                                role=msg_data['role'],
                                content=msg_data['content'],
                                timestamp=datetime.fromisoformat(msg_data['timestamp']),
                                metadata=msg_data.get('metadata', {})
                            )
                            messages.append(msg)
                        
                        conv = Conversation(
                            id=conv_data['id'],
                            user_id=conv_data['user_id'],
                            title=conv_data['title'],
                            messages=messages,
                            created_at=datetime.fromisoformat(conv_data['created_at']),
                            updated_at=datetime.fromisoformat(conv_data['updated_at']),
                            document_context=conv_data.get('document_context', []),
                            summary=conv_data.get('summary')
                        )
                        self.conversations[conv_id] = conv
                        
                logger.info(f"Loaded {len(self.conversations)} conversations from storage")
        except Exception as e:
            logger.error(f"Error loading conversations: {e}")
    
    def _save_conversations(self):
        """Save conversations to storage"""
        try:
            conversations_file = os.path.join(self.storage_dir, "conversations.json")
            data = {}
            for conv_id, conv in self.conversations.items():
                # Convert datetime objects to ISO strings for JSON serialization
                conv_dict = asdict(conv)
                conv_dict['created_at'] = conv.created_at.isoformat()
                conv_dict['updated_at'] = conv.updated_at.isoformat()
                
                messages = []
                for msg in conv.messages:
                    msg_dict = asdict(msg)
                    msg_dict['timestamp'] = msg.timestamp.isoformat()
                    messages.append(msg_dict)
                conv_dict['messages'] = messages
                
                data[conv_id] = conv_dict
            
            with open(conversations_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                
            logger.info(f"Saved {len(self.conversations)} conversations to storage")
        except Exception as e:
            logger.error(f"Error saving conversations: {e}")
    
    def create_conversation(self, user_id: str, title: str = None, document_context: List[str] = None) -> str:
        """Create a new conversation"""
        conv_id = f"conv_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{user_id}"
        
        conversation = Conversation(
            id=conv_id,
            user_id=user_id,
            title=title or f"Conversation {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            messages=[],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            document_context=document_context or []
        )
        
        self.conversations[conv_id] = conversation
        self._save_conversations()
        
        logger.info(f"Created new conversation: {conv_id}")
        return conv_id
    
    def add_message(self, conversation_id: str, role: str, content: str, metadata: Dict[str, Any] = None) -> str:
        """Add a message to a conversation"""
        if conversation_id not in self.conversations:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        message_id = f"msg_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        message = Message(
            id=message_id,
            role=role,
            content=content,
            timestamp=datetime.now(),
            metadata=metadata or {}
        )
        
        conversation = self.conversations[conversation_id]
        conversation.messages.append(message)
        conversation.updated_at = datetime.now()
        
        self._save_conversations()
        
        logger.info(f"Added message to conversation {conversation_id}")
        return message_id
    
    def get_conversation_history(self, conversation_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent conversation history"""
        if conversation_id not in self.conversations:
            return []
        
        conversation = self.conversations[conversation_id]
        recent_messages = conversation.messages[-limit:] if limit else conversation.messages
        
        return [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
                "metadata": msg.metadata
            }
            for msg in recent_messages
        ]
    
    def get_conversation_context(self, conversation_id: str) -> Dict[str, Any]:
        """Get conversation context for AI"""
        if conversation_id not in self.conversations:
            return {}
        
        conversation = self.conversations[conversation_id]
        
        return {
            "conversation_id": conversation_id,
            "title": conversation.title,
            "document_context": conversation.document_context,
            "message_count": len(conversation.messages),
            "last_updated": conversation.updated_at.isoformat(),
            "summary": conversation.summary
        }
    
    def get_user_conversations(self, user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get all conversations for a user"""
        user_conversations = [
            conv for conv in self.conversations.values()
            if conv.user_id == user_id
        ]
        
        # Sort by updated_at descending
        user_conversations.sort(key=lambda x: x.updated_at, reverse=True)
        
        return [
            {
                "id": conv.id,
                "title": conv.title,
                "message_count": len(conv.messages),
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat(),
                "document_context": conv.document_context,
                "summary": conv.summary
            }
            for conv in user_conversations[:limit]
        ]
    
    def update_conversation_summary(self, conversation_id: str, summary: str):
        """Update conversation summary"""
        if conversation_id in self.conversations:
            self.conversations[conversation_id].summary = summary
            self.conversations[conversation_id].updated_at = datetime.now()
            self._save_conversations()
            logger.info(f"Updated summary for conversation {conversation_id}")
    
    def delete_conversation(self, conversation_id: str):
        """Delete a conversation"""
        if conversation_id in self.conversations:
            del self.conversations[conversation_id]
            self._save_conversations()
            logger.info(f"Deleted conversation {conversation_id}")
    
    def cleanup_old_conversations(self, days_old: int = 30):
        """Clean up conversations older than specified days"""
        cutoff_date = datetime.now() - timedelta(days=days_old)
        old_conversations = [
            conv_id for conv_id, conv in self.conversations.items()
            if conv.updated_at < cutoff_date
        ]
        
        for conv_id in old_conversations:
            del self.conversations[conv_id]
        
        if old_conversations:
            self._save_conversations()
            logger.info(f"Cleaned up {len(old_conversations)} old conversations")

# Global conversation memory instance
conversation_memory = ConversationMemory()
