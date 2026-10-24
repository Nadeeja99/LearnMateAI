import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import API_CONFIG from "@/lib/api";
import PageHeader from "@/components/app/PageHeader";
import IconBadge from "@/components/app/IconBadge";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  FileText, 
  MessageSquare, 
  Brain, 
  Clock,
  Target,
  RefreshCw,
  Activity,
  type LucideIcon
} from "lucide-react";

interface UserAnalytics {
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

interface GlobalAnalytics {
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

const formatLabel = (key: string) => {
  const label = key.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const StatCard = ({ title, value, icon, subtitle }: { title: string; value: string | number; icon: LucideIcon; subtitle?: string }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <IconBadge icon={icon} size="sm" />
    </div>
  </Card>
);

const BarList = ({ title, rows }: { title: string; rows: [string, number][] }) => {
  const maxValue = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="mb-5 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet</p>
      ) : (
        <div className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 truncate capitalize text-muted-foreground">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(value / maxValue) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-medium tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const activityRows = (data: Record<string, number>): [string, number][] =>
  Object.entries(data)
    .slice(-7) // Last 7 days
    .map(([date, value]) => [new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value]);

const distributionRows = (data: Record<string, number>): [string, number][] =>
  Object.entries(data).map(([key, value]) => [formatLabel(key), value]);

const AnalyticsDashboard = () => {
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [globalAnalytics, setGlobalAnalytics] = useState<GlobalAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"user" | "global">("user");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      // Load user analytics
      const userResponse = await fetch(API_CONFIG.ENDPOINTS.ANALYTICS_USER("default"));
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserAnalytics(userData);
      }

      // Load global analytics
      const globalResponse = await fetch(API_CONFIG.ENDPOINTS.ANALYTICS_GLOBAL);
      if (globalResponse.ok) {
        const globalData = await globalResponse.json();
        setGlobalAnalytics(globalData);
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Learning analytics"
        description={isLoading ? "Loading your learning insights…" : "Track your learning progress and insights"}
        actions={
          <Button onClick={loadAnalytics} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={isLoading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      <div className="mb-8 inline-flex rounded-lg border p-0.5" role="tablist">
        {(["user", "global"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3.5 py-1.5 text-sm transition-colors ${
              activeTab === tab ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "user" ? "Your progress" : "Global insights"}
          </button>
        ))}
      </div>

      {activeTab === "user" && userAnalytics && (
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
      )}

      {activeTab === "global" && globalAnalytics && (
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
      )}
    </div>
  );
};

export default AnalyticsDashboard;
