import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Activity
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
      const userResponse = await fetch("http://localhost:8000/analytics/user/default");
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserAnalytics(userData);
      }

      // Load global analytics
      const globalResponse = await fetch("http://localhost:8000/analytics/global");
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

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = "primary",
    subtitle 
  }: {
    title: string;
    value: string | number;
    icon: any;
    color?: string;
    subtitle?: string;
  }) => (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg bg-${color}/10`}>
          <Icon className={`h-6 w-6 text-${color}`} />
        </div>
      </div>
    </Card>
  );

  const ActivityChart = ({ data, title }: { data: Record<string, number>; title: string }) => {
    const maxValue = Math.max(...Object.values(data));
    const entries = Object.entries(data).slice(-7); // Last 7 days

    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="space-y-3">
          {entries.map(([date, value]) => (
            <div key={date} className="flex items-center gap-3">
              <span className="text-sm w-20 text-muted-foreground">
                {new Date(date).toLocaleDateString()}
              </span>
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(value / maxValue) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium w-8">{value}</span>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  const DistributionChart = ({ data, title }: { data: Record<string, number>; title: string }) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="space-y-3">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm capitalize">{key.replace('_', ' ')}</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${(value / total) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-2">Learning Analytics Dashboard</h2>
          <p className="text-muted-foreground">Loading your learning insights...</p>
        </div>
        <div className="flex items-center justify-center flex-1">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold">Learning Analytics Dashboard</h2>
          <Button onClick={loadAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <p className="text-muted-foreground">Track your learning progress and insights</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "user" ? "default" : "outline"}
          onClick={() => setActiveTab("user")}
        >
          Your Progress
        </Button>
        <Button
          variant={activeTab === "global" ? "default" : "outline"}
          onClick={() => setActiveTab("global")}
        >
          Global Insights
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === "user" && userAnalytics && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Sessions"
                value={userAnalytics.total_sessions}
                icon={Activity}
                subtitle="All learning activities"
              />
              <StatCard
                title="Learning Streak"
                value={`${userAnalytics.learning_streak_days} days`}
                icon={TrendingUp}
                color="green"
                subtitle="Current streak"
              />
              <StatCard
                title="Documents Uploaded"
                value={userAnalytics.total_documents_uploaded}
                icon={FileText}
                color="blue"
                subtitle="PDF documents"
              />
              <StatCard
                title="Questions Asked"
                value={userAnalytics.total_questions_asked}
                icon={MessageSquare}
                color="purple"
                subtitle="AI interactions"
              />
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Summaries Generated"
                value={userAnalytics.total_summaries_generated}
                icon={Brain}
                color="orange"
              />
              <StatCard
                title="Quizzes Taken"
                value={userAnalytics.total_quizzes_taken}
                icon={Target}
                color="red"
              />
              <StatCard
                title="Chat Messages"
                value={userAnalytics.total_chat_messages}
                icon={MessageSquare}
                color="indigo"
              />
            </div>

            {/* Learning Patterns */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Learning Patterns</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">Most Active Hour</p>
                  <p className="font-semibold">{userAnalytics.learning_patterns.most_active_hour}:00</p>
                </div>
                <div className="text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">Preferred Activity</p>
                  <p className="font-semibold capitalize">{userAnalytics.learning_patterns.preferred_session_type.replace('_', ' ')}</p>
                </div>
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">Avg Sessions/Day</p>
                  <p className="font-semibold">{userAnalytics.learning_patterns.average_sessions_per_day.toFixed(1)}</p>
                </div>
              </div>
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ActivityChart 
                data={userAnalytics.daily_activity} 
                title="Daily Activity (Last 7 Days)" 
              />
              <DistributionChart 
                data={userAnalytics.session_types_distribution} 
                title="Session Types Distribution" 
              />
            </div>
          </div>
        )}

        {activeTab === "global" && globalAnalytics && (
          <div className="space-y-6">
            {/* Global Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Users"
                value={globalAnalytics.total_users}
                icon={Users}
                subtitle="Platform users"
              />
              <StatCard
                title="Total Sessions"
                value={globalAnalytics.total_sessions}
                icon={Activity}
                subtitle="All activities"
              />
              <StatCard
                title="Avg Sessions/User"
                value={globalAnalytics.average_sessions_per_user.toFixed(1)}
                icon={TrendingUp}
                color="green"
                subtitle="User engagement"
              />
              <StatCard
                title="Avg Learning Streak"
                value={`${globalAnalytics.average_learning_streak.toFixed(1)} days`}
                icon={Target}
                color="blue"
                subtitle="Platform average"
              />
            </div>

            {/* Popular Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Most Popular Activity</h3>
                <div className="flex items-center gap-3">
                  <Activity className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold capitalize">
                      {globalAnalytics.most_popular_session_type.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-muted-foreground">Most used feature</p>
                  </div>
                </div>
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Most Popular Document Type</h3>
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold uppercase">
                      {globalAnalytics.most_popular_document_type}
                    </p>
                    <p className="text-sm text-muted-foreground">Most uploaded format</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Global Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ActivityChart 
                data={globalAnalytics.daily_activity} 
                title="Global Daily Activity (Last 7 Days)" 
              />
              <DistributionChart 
                data={globalAnalytics.session_types_distribution} 
                title="Global Session Types" 
              />
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default AnalyticsDashboard;
