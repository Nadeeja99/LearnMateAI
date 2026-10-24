export interface UserAnalytics {
  user_id: string;
  total_sessions: number;
  total_documents_uploaded: number;
  total_questions_asked: number;
  total_summaries_generated: number;
  total_quizzes_taken: number;
  total_chat_messages: number;
  learning_streak_days: number;
  last_activity: string;
  session_types_distribution: Record<string, number>;
  document_types_distribution: Record<string, number>;
  daily_activity: Record<string, number>;
  learning_patterns: {
    most_active_hour: number;
    preferred_session_type: string;
    average_sessions_per_day: number;
  };
}

export interface GlobalAnalytics {
  total_users: number;
  total_sessions: number;
  average_sessions_per_user: number;
  average_learning_streak: number;
  session_types_distribution: Record<string, number>;
  document_types_distribution: Record<string, number>;
  daily_activity: Record<string, number>;
  most_popular_session_type: string;
  most_popular_document_type: string;
}

export const formatLabel = (key: string) => {
  const label = key.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const activityRows = (data: Record<string, number>): [string, number][] =>
  Object.entries(data)
    .slice(-7) // Last 7 days
    .map(([date, value]) => [new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value]);

export const distributionRows = (data: Record<string, number>): [string, number][] =>
  Object.entries(data).map(([key, value]) => [formatLabel(key), value]);
