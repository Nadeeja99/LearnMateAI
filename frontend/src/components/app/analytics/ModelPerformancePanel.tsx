import { useCallback, useEffect, useState } from "react";
import { Gauge, ThumbsUp, Timer, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import API_CONFIG from "@/lib/api";
import { errorText, requestJson } from "@/lib/http";
import { formatMs } from "@/lib/telemetry";
import EmptyState from "@/components/app/EmptyState";
import InlineError from "@/components/app/InlineError";
import { AnalyticsSkeleton, BarList, StatCard } from "./AnalyticsWidgets";

/** GET /analytics/model-performance (see LearningAnalytics.get_model_performance) */
interface ModelPerformance {
  days: number;
  ttft_ms: { count: number; p50: number | null; p95: number | null; mean: number | null };
  daily_ttft_p50: Record<string, number>;
  by_model: Record<string, { count: number; p50: number }>;
  feedback: { up: number; down: number; helpful_rate: number | null };
}

/** Latency (time to first token) and answer-quality feedback across all chats. */
const ModelPerformancePanel = () => {
  const [data, setData] = useState<ModelPerformance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await requestJson<ModelPerformance>(`${API_CONFIG.ENDPOINTS.MODEL_PERFORMANCE}?days=30`));
    } catch (err) {
      setError(errorText(err, "Couldn't load model performance."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <InlineError title="Couldn't load model performance" message={error} onRetry={load} />;
  if (!data) return <AnalyticsSkeleton />;

  const { ttft_ms: ttft, feedback } = data;
  if (ttft.count === 0 && feedback.up + feedback.down === 0) {
    return (
      <Card>
        <EmptyState icon={Gauge} title="No model data yet" description="Ask a few questions in Chat. Response latency and your thumbs up/down ratings will appear here." />
      </Card>
    );
  }

  const daily: [string, number][] = Object.entries(data.daily_ttft_p50)
    .slice(-7)
    .map(([day, value]) => [new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric" }), Math.round(value)]);
  const models: [string, number][] = Object.entries(data.by_model).map(([model, stats]) => [model, Math.round(stats.p50)]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Median time to first token" value={formatMs(ttft.p50)} icon={Zap} subtitle={`${ttft.count} streamed answers · ${data.days} days`} />
        <StatCard title="p95 time to first token" value={formatMs(ttft.p95)} icon={Timer} subtitle="Slowest 5% start after this" />
        <StatCard title="Mean time to first token" value={formatMs(ttft.mean)} icon={Gauge} subtitle="Includes retrieval" />
        <StatCard
          title="Rated helpful"
          value={feedback.helpful_rate == null ? "–" : `${Math.round(feedback.helpful_rate * 100)}%`}
          icon={ThumbsUp}
          subtitle={`${feedback.up} up · ${feedback.down} down`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="Median TTFT by day (ms)" rows={daily} />
        <BarList title="Median TTFT by model (ms)" rows={models} />
      </div>
    </div>
  );
};

export default ModelPerformancePanel;
