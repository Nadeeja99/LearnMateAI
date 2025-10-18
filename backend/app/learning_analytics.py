"""
Learning Analytics System for LearnMate AI
Tracks user progress, learning patterns, and performance metrics
"""

import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

@dataclass
class LearningSession:
    """Individual learning session"""
    id: str
    user_id: str
    session_type: str  # 'upload', 'question', 'summary', 'quiz', 'chat'
    document_name: Optional[str]
    duration_seconds: int
    timestamp: datetime
    metadata: Dict[str, Any] = None

@dataclass
class UserProgress:
    """User learning progress tracking"""
    user_id: str
    total_sessions: int
    total_documents_uploaded: int
    total_questions_asked: int
    total_summaries_generated: int
    total_quizzes_taken: int
    total_chat_messages: int
    learning_streak_days: int
    last_activity: datetime
    preferred_document_types: List[str] = None
    learning_patterns: Dict[str, Any] = None

@dataclass
class PerformanceMetric:
    """Performance metric for analytics"""
    metric_name: str
    value: float
    timestamp: datetime
    context: Dict[str, Any] = None

class LearningAnalytics:
    """Manages learning analytics and user progress tracking"""
    
    def __init__(self, storage_dir: str = "data/analytics"):
        self.storage_dir = storage_dir
        self.sessions: List[LearningSession] = []
        self.user_progress: Dict[str, UserProgress] = {}
        self.performance_metrics: List[PerformanceMetric] = []
        self._ensure_storage_dir()
        self._load_data()
    
    def _ensure_storage_dir(self):
        """Ensure storage directory exists"""
        os.makedirs(self.storage_dir, exist_ok=True)
    
    def _load_data(self):
        """Load analytics data from storage"""
        try:
            # Load sessions
            sessions_file = os.path.join(self.storage_dir, "sessions.json")
            if os.path.exists(sessions_file):
                with open(sessions_file, 'r', encoding='utf-8') as f:
                    sessions_data = json.load(f)
                    for session_data in sessions_data:
                        session = LearningSession(
                            id=session_data['id'],
                            user_id=session_data['user_id'],
                            session_type=session_data['session_type'],
                            document_name=session_data.get('document_name'),
                            duration_seconds=session_data['duration_seconds'],
                            timestamp=datetime.fromisoformat(session_data['timestamp']),
                            metadata=session_data.get('metadata', {})
                        )
                        self.sessions.append(session)
            
            # Load user progress
            progress_file = os.path.join(self.storage_dir, "user_progress.json")
            if os.path.exists(progress_file):
                with open(progress_file, 'r', encoding='utf-8') as f:
                    progress_data = json.load(f)
                    for user_id, user_data in progress_data.items():
                        progress = UserProgress(
                            user_id=user_id,
                            total_sessions=user_data['total_sessions'],
                            total_documents_uploaded=user_data['total_documents_uploaded'],
                            total_questions_asked=user_data['total_questions_asked'],
                            total_summaries_generated=user_data['total_summaries_generated'],
                            total_quizzes_taken=user_data['total_quizzes_taken'],
                            total_chat_messages=user_data['total_chat_messages'],
                            learning_streak_days=user_data['learning_streak_days'],
                            last_activity=datetime.fromisoformat(user_data['last_activity']),
                            preferred_document_types=user_data.get('preferred_document_types', []),
                            learning_patterns=user_data.get('learning_patterns', {})
                        )
                        self.user_progress[user_id] = progress
            
            # Load performance metrics
            metrics_file = os.path.join(self.storage_dir, "performance_metrics.json")
            if os.path.exists(metrics_file):
                with open(metrics_file, 'r', encoding='utf-8') as f:
                    metrics_data = json.load(f)
                    for metric_data in metrics_data:
                        metric = PerformanceMetric(
                            metric_name=metric_data['metric_name'],
                            value=metric_data['value'],
                            timestamp=datetime.fromisoformat(metric_data['timestamp']),
                            context=metric_data.get('context', {})
                        )
                        self.performance_metrics.append(metric)
            
            logger.info(f"Loaded analytics data: {len(self.sessions)} sessions, {len(self.user_progress)} users, {len(self.performance_metrics)} metrics")
        except Exception as e:
            logger.error(f"Error loading analytics data: {e}")
    
    def _save_data(self):
        """Save analytics data to storage"""
        try:
            # Save sessions
            sessions_file = os.path.join(self.storage_dir, "sessions.json")
            sessions_data = []
            for session in self.sessions:
                session_dict = asdict(session)
                session_dict['timestamp'] = session.timestamp.isoformat()
                sessions_data.append(session_dict)
            
            with open(sessions_file, 'w', encoding='utf-8') as f:
                json.dump(sessions_data, f, indent=2, ensure_ascii=False)
            
            # Save user progress
            progress_file = os.path.join(self.storage_dir, "user_progress.json")
            progress_data = {}
            for user_id, progress in self.user_progress.items():
                progress_dict = asdict(progress)
                progress_dict['last_activity'] = progress.last_activity.isoformat()
                progress_data[user_id] = progress_dict
            
            with open(progress_file, 'w', encoding='utf-8') as f:
                json.dump(progress_data, f, indent=2, ensure_ascii=False)
            
            # Save performance metrics
            metrics_file = os.path.join(self.storage_dir, "performance_metrics.json")
            metrics_data = []
            for metric in self.performance_metrics:
                metric_dict = asdict(metric)
                metric_dict['timestamp'] = metric.timestamp.isoformat()
                metrics_data.append(metric_dict)
            
            with open(metrics_file, 'w', encoding='utf-8') as f:
                json.dump(metrics_data, f, indent=2, ensure_ascii=False)
            
            logger.info("Analytics data saved successfully")
        except Exception as e:
            logger.error(f"Error saving analytics data: {e}")
    
    def track_session(self, user_id: str, session_type: str, document_name: str = None, 
                     duration_seconds: int = 0, metadata: Dict[str, Any] = None):
        """Track a learning session"""
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        session = LearningSession(
            id=session_id,
            user_id=user_id,
            session_type=session_type,
            document_name=document_name,
            duration_seconds=duration_seconds,
            timestamp=datetime.now(),
            metadata=metadata or {}
        )
        
        self.sessions.append(session)
        
        # Update user progress
        self._update_user_progress(user_id, session_type)
        
        self._save_data()
        logger.info(f"Tracked session: {session_type} for user {user_id}")
    
    def _update_user_progress(self, user_id: str, session_type: str):
        """Update user progress based on session type"""
        if user_id not in self.user_progress:
            self.user_progress[user_id] = UserProgress(
                user_id=user_id,
                total_sessions=0,
                total_documents_uploaded=0,
                total_questions_asked=0,
                total_summaries_generated=0,
                total_quizzes_taken=0,
                total_chat_messages=0,
                learning_streak_days=0,
                last_activity=datetime.now()
            )
        
        progress = self.user_progress[user_id]
        progress.total_sessions += 1
        progress.last_activity = datetime.now()
        
        # Update specific counters
        if session_type == 'upload':
            progress.total_documents_uploaded += 1
        elif session_type == 'question':
            progress.total_questions_asked += 1
        elif session_type == 'chat':  # Chat messages are now tracked as "chat"
            progress.total_chat_messages += 1
        elif session_type == 'summary':
            progress.total_summaries_generated += 1
        elif session_type == 'quiz':
            progress.total_quizzes_taken += 1
        
        # Update learning streak
        self._update_learning_streak(progress)
    
    def _update_learning_streak(self, progress: UserProgress):
        """Update learning streak based on activity"""
        now = datetime.now()
        if progress.last_activity.date() == now.date():
            # Activity today, check if we should increment streak
            yesterday = now - timedelta(days=1)
            if progress.last_activity.date() == yesterday.date():
                progress.learning_streak_days += 1
            else:
                progress.learning_streak_days = 1
        else:
            # No activity today, reset streak
            progress.learning_streak_days = 0
    
    def get_user_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive analytics for a user"""
        if user_id not in self.user_progress:
            return {}
        
        progress = self.user_progress[user_id]
        user_sessions = [s for s in self.sessions if s.user_id == user_id]
        
        # Calculate additional metrics
        session_types = defaultdict(int)
        document_types = defaultdict(int)
        daily_activity = defaultdict(int)
        
        for session in user_sessions:
            session_types[session.session_type] += 1
            if session.document_name:
                doc_type = session.document_name.split('.')[-1].lower()
                document_types[doc_type] += 1
            daily_activity[session.timestamp.date().isoformat()] += 1
        
        # Count "question" sessions as chat messages for backward compatibility
        if "question" in session_types:
            progress.total_chat_messages += session_types["question"]
        
        # Calculate learning patterns
        most_active_hour = self._calculate_most_active_hour(user_sessions)
        preferred_session_type = max(session_types.items(), key=lambda x: x[1])[0] if session_types else None
        
        return {
            "user_id": user_id,
            "total_sessions": progress.total_sessions,
            "total_documents_uploaded": progress.total_documents_uploaded,
            "total_questions_asked": progress.total_questions_asked,
            "total_summaries_generated": progress.total_summaries_generated,
            "total_quizzes_taken": progress.total_quizzes_taken,
            "total_chat_messages": progress.total_chat_messages,
            "learning_streak_days": progress.learning_streak_days,
            "last_activity": progress.last_activity.isoformat(),
            "session_types_distribution": dict(session_types),
            "document_types_distribution": dict(document_types),
            "daily_activity": dict(daily_activity),
            "learning_patterns": {
                "most_active_hour": most_active_hour,
                "preferred_session_type": preferred_session_type,
                "average_sessions_per_day": len(user_sessions) / max(1, (datetime.now() - progress.last_activity).days + 1)
            }
        }
    
    def _calculate_most_active_hour(self, sessions: List[LearningSession]) -> int:
        """Calculate the hour when user is most active"""
        hour_counts = defaultdict(int)
        for session in sessions:
            hour_counts[session.timestamp.hour] += 1
        
        return max(hour_counts.items(), key=lambda x: x[1])[0] if hour_counts else 12
    
    def get_global_analytics(self) -> Dict[str, Any]:
        """Get global analytics across all users"""
        total_users = len(self.user_progress)
        total_sessions = len(self.sessions)
        
        if total_sessions == 0:
            return {"total_users": total_users, "total_sessions": 0}
        
        # Calculate global metrics
        session_types = defaultdict(int)
        document_types = defaultdict(int)
        daily_activity = defaultdict(int)
        
        for session in self.sessions:
            session_types[session.session_type] += 1
            if session.document_name:
                doc_type = session.document_name.split('.')[-1].lower()
                document_types[doc_type] += 1
            daily_activity[session.timestamp.date().isoformat()] += 1
        
        # Calculate averages
        avg_sessions_per_user = total_sessions / max(1, total_users)
        avg_streak = sum(p.learning_streak_days for p in self.user_progress.values()) / max(1, total_users)
        
        return {
            "total_users": total_users,
            "total_sessions": total_sessions,
            "average_sessions_per_user": avg_sessions_per_user,
            "average_learning_streak": avg_streak,
            "session_types_distribution": dict(session_types),
            "document_types_distribution": dict(document_types),
            "daily_activity": dict(daily_activity),
            "most_popular_session_type": max(session_types.items(), key=lambda x: x[1])[0] if session_types else None,
            "most_popular_document_type": max(document_types.items(), key=lambda x: x[1])[0] if document_types else None
        }
    
    def add_performance_metric(self, metric_name: str, value: float, context: Dict[str, Any] = None):
        """Add a performance metric"""
        metric = PerformanceMetric(
            metric_name=metric_name,
            value=value,
            timestamp=datetime.now(),
            context=context or {}
        )
        
        self.performance_metrics.append(metric)
        self._save_data()
        logger.info(f"Added performance metric: {metric_name} = {value}")
    
    def get_performance_metrics(self, metric_name: str = None, days: int = 30) -> List[Dict[str, Any]]:
        """Get performance metrics"""
        cutoff_date = datetime.now() - timedelta(days=days)
        
        filtered_metrics = [
            metric for metric in self.performance_metrics
            if metric.timestamp >= cutoff_date and (metric_name is None or metric.metric_name == metric_name)
        ]
        
        return [
            {
                "metric_name": metric.metric_name,
                "value": metric.value,
                "timestamp": metric.timestamp.isoformat(),
                "context": metric.context
            }
            for metric in filtered_metrics
        ]
    
    def cleanup_old_data(self, days_old: int = 90):
        """Clean up old analytics data"""
        cutoff_date = datetime.now() - timedelta(days=days_old)
        
        old_sessions = [s for s in self.sessions if s.timestamp < cutoff_date]
        old_metrics = [m for m in self.performance_metrics if m.timestamp < cutoff_date]
        
        self.sessions = [s for s in self.sessions if s.timestamp >= cutoff_date]
        self.performance_metrics = [m for m in self.performance_metrics if m.timestamp >= cutoff_date]
        
        if old_sessions or old_metrics:
            self._save_data()
            logger.info(f"Cleaned up {len(old_sessions)} old sessions and {len(old_metrics)} old metrics")

# Global learning analytics instance
learning_analytics = LearningAnalytics()
