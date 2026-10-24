import { Activity, BarChart3, Brain, Clock, FileText, MessageSquare, Target, TrendingUp, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarList, StatCard } from "./AnalyticsWidgets";
import { activityRows, distributionRows, formatLabel, type GlobalAnalytics, type UserAnalytics } from "./types";

export const UserAnalyticsPanel = ({ userAnalytics }: { userAnalytics: UserAnalytics }) => (
  <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total sessions" value={userAnalytics.total_sessions} icon={Activity} subtitle="All learning activities" />
      <StatCard title="Learning streak" value={`${userAnalytics.learning_streak_days} days`} icon={TrendingUp} subtitle="Current streak" />
      <StatCard title="Documents uploaded" value={userAnalytics.total_documents_uploaded} icon={FileText} subtitle="PDF documents" />
      <StatCard title="Questions asked" value={userAnalytics.total_questions_asked} icon={MessageSquare} subtitle="AI interactions" />
    </div>

    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard title="Summaries generated" value={userAnalytics.total_summaries_generated} icon={Brain} />
      <StatCard title="Quizzes taken" value={userAnalytics.total_quizzes_taken} icon={Target} />
      <StatCard title="Chat messages" value={userAnalytics.total_chat_messages} icon={MessageSquare} />
    </div>

    <Card className="grid gap-6 p-6 sm:grid-cols-3">
      {[
        { icon: Clock, label: "Most active hour", value: `${userAnalytics.learning_patterns.most_active_hour}:00` },
        { icon: Target, label: "Preferred activity", value: formatLabel(userAnalytics.learning_patterns.preferred_session_type) },
        { icon: TrendingUp, label: "Avg sessions / day", value: userAnalytics.learning_patterns.average_sessions_per_day.toFixed(1) },
      ].map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-medium capitalize">{value}</p>
          </div>
        </div>
      ))}
    </Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <BarList title="Daily activity · last 7 days" rows={activityRows(userAnalytics.daily_activity)} />
      <BarList title="Session types" rows={distributionRows(userAnalytics.session_types_distribution)} />
    </div>
  </div>
);

export const GlobalAnalyticsPanel = ({ globalAnalytics }: { globalAnalytics: GlobalAnalytics }) => (
  <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total users" value={globalAnalytics.total_users} icon={Users} subtitle="Platform users" />
      <StatCard title="Total sessions" value={globalAnalytics.total_sessions} icon={Activity} subtitle="All activities" />
      <StatCard title="Avg sessions / user" value={globalAnalytics.average_sessions_per_user.toFixed(1)} icon={TrendingUp} subtitle="User engagement" />
      <StatCard title="Avg learning streak" value={`${globalAnalytics.average_learning_streak.toFixed(1)} days`} icon={Target} subtitle="Platform average" />
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <StatCard title="Most popular activity" value={formatLabel(globalAnalytics.most_popular_session_type)} icon={BarChart3} subtitle="Most used feature" />
      <StatCard title="Most popular document type" value={globalAnalytics.most_popular_document_type.toUpperCase()} icon={FileText} subtitle="Most uploaded format" />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <BarList title="Global daily activity · last 7 days" rows={activityRows(globalAnalytics.daily_activity)} />
      <BarList title="Global session types" rows={distributionRows(globalAnalytics.session_types_distribution)} />
    </div>
  </div>
);
