import { useState, useEffect, useCallback } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import API_CONFIG from "@/lib/api";
import { errorText, requestJson } from "@/lib/http";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import InlineError from "@/components/app/InlineError";
import { AnalyticsSkeleton } from "@/components/app/analytics/AnalyticsWidgets";
import { GlobalAnalyticsPanel, UserAnalyticsPanel } from "@/components/app/analytics/AnalyticsPanels";
import type { GlobalAnalytics, UserAnalytics } from "@/components/app/analytics/types";

type Tab = "user" | "global";

const AnalyticsDashboard = () => {
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(null);
  const [globalAnalytics, setGlobalAnalytics] = useState<GlobalAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("user");

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [user, global] = await Promise.allSettled([
      requestJson<UserAnalytics>(API_CONFIG.ENDPOINTS.ANALYTICS_USER("default")),
      requestJson<GlobalAnalytics>(API_CONFIG.ENDPOINTS.ANALYTICS_GLOBAL),
    ]);
    if (user.status === "fulfilled") setUserAnalytics(user.value);
    if (global.status === "fulfilled") setGlobalAnalytics(global.value);

    const failure = [user, global].find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failure) {
      console.error("Error loading analytics:", failure.reason);
      setError(errorText(failure.reason, "Couldn't load analytics."));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const tabData = activeTab === "user" ? userAnalytics : globalAnalytics;
  // The API returns {} (user) or a partial object (global) before any sessions exist
  const hasActivity = tabData !== null && tabData.total_sessions > 0;

  const renderBody = () => {
    if (isLoading && !tabData) return <AnalyticsSkeleton />;
    if (!tabData) return null; // load failed; the error panel explains why
    if (!hasActivity) {
      return (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="No activity yet"
            description="Chat, summarize, or take a quiz and your learning insights will appear here."
          />
        </Card>
      );
    }
    return userAnalytics && activeTab === "user" ? (
      <UserAnalyticsPanel userAnalytics={userAnalytics} />
    ) : (
      globalAnalytics && <GlobalAnalyticsPanel globalAnalytics={globalAnalytics} />
    );
  };

  return (
    <div>
      <PageHeader
        title="Learning analytics"
        description="Track your learning progress and insights"
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
            className={`rounded-md px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "user" ? "Your progress" : "Global insights"}
          </button>
        ))}
      </div>

      {error && <InlineError className="mb-6" title="Couldn't load analytics" message={error} onRetry={loadAnalytics} />}
      {renderBody()}
    </div>
  );
};

export default AnalyticsDashboard;
