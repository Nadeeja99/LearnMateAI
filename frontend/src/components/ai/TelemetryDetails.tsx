import type { ReactNode } from "react";
import { Check, ChevronRight, Copy, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCopy } from "@/hooks/use-copy";
import { formatCount, type SourceChunk } from "@/lib/telemetry";

const Section = ({ title, meta, children }: { title: string; meta: string; children: ReactNode }) => (
  <Collapsible className="mt-3 rounded-md border">
    <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-muted-foreground">{meta}</span>
    </CollapsibleTrigger>
    <CollapsibleContent className="border-t">{children}</CollapsibleContent>
  </Collapsible>
);

const SourceList = ({ sources }: { sources: SourceChunk[] }) => {
  const maxDistance = Math.max(...sources.map((s) => s.distance), 0.0001);

  return (
    <ol className="divide-y">
      {sources.map((chunk) => (
        <li key={chunk.rank} className="space-y-1.5 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground">#{chunk.rank}</span>
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{chunk.source}</span>
            <span className="hidden h-1 w-16 overflow-hidden rounded-full bg-muted sm:block" title="Relative closeness to the query">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(1 - chunk.distance / maxDistance) * 80 + 20}%` }} />
            </span>
            <span className="font-mono tabular-nums text-muted-foreground" title="L2 distance (lower is closer)">
              d={chunk.distance.toFixed(3)}
            </span>
          </div>
          <p className="line-clamp-3 leading-relaxed text-muted-foreground">
            {chunk.preview}
            {chunk.characters > chunk.preview.length && "…"}
          </p>
        </li>
      ))}
    </ol>
  );
};

const PromptViewer = ({ prompt }: { prompt: string }) => {
  const { copied, copy } = useCopy();
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => copy(prompt)}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
        aria-label="Copy prompt"
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 pr-20 font-mono text-[0.75rem] leading-relaxed text-muted-foreground">
        {prompt}
      </pre>
    </div>
  );
};

interface TelemetryDetailsProps {
  sources: SourceChunk[];
  systemPrompt?: string | null;
}

/** Collapsible retrieved-context and raw-prompt sections of the telemetry inspector. */
const TelemetryDetails = ({ sources, systemPrompt }: TelemetryDetailsProps) => (
  <>
    <Section title="Retrieved context" meta={`${sources.length} ${sources.length === 1 ? "chunk" : "chunks"}`}>
      {sources.length ? <SourceList sources={sources} /> : <p className="px-3 py-2.5 text-muted-foreground">No chunks matched the query.</p>}
    </Section>
    <Section title="Prompt" meta={systemPrompt ? `${formatCount(systemPrompt.length)} chars` : "not available"}>
      {systemPrompt ? (
        <PromptViewer prompt={systemPrompt} />
      ) : (
        <p className="px-3 py-2.5 text-muted-foreground">Prompts aren't stored with saved conversations, only with live responses.</p>
      )}
    </Section>
  </>
);

export default TelemetryDetails;
