import type { ReactNode } from "react";
import { Activity, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCount, formatMs, type Telemetry } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import TelemetryDetails from "./TelemetryDetails";

interface TelemetryPanelProps {
  telemetry: Telemetry;
  className?: string;
}

const Metric = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="min-w-0">
    <dt className="truncate text-[0.6875rem] uppercase tracking-wider text-muted-foreground" title={hint}>
      {label}
    </dt>
    <dd className="mt-0.5 truncate font-mono text-[0.8125rem] tabular-nums text-foreground">{value}</dd>
  </div>
);

/** Expandable "System telemetry" inspector attached to an AI output. */
const TelemetryPanel = ({ telemetry, className }: TelemetryPanelProps) => {
  const { usage, client, structured_output: structured } = telemetry;
  const tokens = `${usage.estimated ? "≈" : ""}${formatCount(usage.total_tokens)} tok`;
  const ttft = client?.ttft_ms ?? telemetry.ttft_ms;

  return (
    <Collapsible className={cn("rounded-lg border bg-background/60 text-xs", className)}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Activity className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="font-medium text-foreground">System telemetry</span>
        <span className="hidden min-w-0 flex-1 truncate font-mono sm:block">
          {telemetry.model}
          {ttft != null && <> · TTFT {formatMs(ttft)}</>} · {formatMs(client?.total_ms ?? telemetry.total_ms)} · {tokens}
        </span>
        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t px-3 pb-3 pt-3 data-[state=open]:animate-fade-in">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Metric label="Model" value={telemetry.model} />
          <Metric label="Finish reason" value={telemetry.finish_reason ?? "–"} />
          <Metric label="TTFT · server" value={formatMs(telemetry.ttft_ms)} hint="Request received → first token, including retrieval" />
          <Metric label="TTFT · client" value={formatMs(client?.ttft_ms)} hint="Request sent → first token rendered, including network" />
          <Metric label="Retrieval" value={formatMs(telemetry.retrieval_ms)} hint="Embedding + vector search" />
          <Metric label="Generation" value={formatMs(telemetry.generation_ms)} />
          <Metric label="Total · server" value={formatMs(telemetry.total_ms)} />
          <Metric label="Total · client" value={formatMs(client?.total_ms)} />
          <Metric label="Input tokens" value={formatCount(usage.input_tokens)} />
          <Metric label="Output tokens" value={formatCount(usage.output_tokens)} />
          <Metric
            label="Total tokens"
            value={`${usage.estimated ? "≈ " : ""}${formatCount(usage.total_tokens)}`}
            hint={usage.estimated ? "Estimated (~4 chars/token): the provider returned no usage" : "Reported by the provider"}
          />
          <Metric label="Throughput" value={telemetry.tokens_per_second == null ? "–" : `${telemetry.tokens_per_second} tok/s`} />
          {structured && (
            <Metric
              label="Structured output"
              value={`${structured.schema} · ${structured.method} · ${structured.validated ? "valid" : "invalid"} · ${structured.items} items`}
            />
          )}
        </dl>

        <TelemetryDetails sources={telemetry.sources} systemPrompt={telemetry.system_prompt} />
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TelemetryPanel;
