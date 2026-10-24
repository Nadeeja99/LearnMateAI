import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, FileText, Copy, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHotkey } from "@/hooks/use-hotkey";
import { useAbortController } from "@/hooks/use-abort-controller";
import API_CONFIG from "@/lib/api";
import { errorText, isAbortError } from "@/lib/http";
import { MOD_KEY_LABEL } from "@/lib/keyboard";
import { printSummary } from "@/lib/print-summary";
import { frameBatched, streamCompletion } from "@/lib/stream";
import type { Telemetry } from "@/lib/telemetry";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import InlineError from "@/components/app/InlineError";
import Kbd from "@/components/app/Kbd";
import Markdown from "@/components/ai/LazyMarkdown";
import TelemetryPanel from "@/components/ai/TelemetryPanel";

interface SummaryViewProps {
  documents: string[];
}

const SUMMARY_SECTIONS = [
  ["Main topics", "Core subjects covered"],
  ["Key concepts", "Important ideas"],
  ["Takeaways", "Essential insights"],
];

const SummarySkeleton = () => (
  <Card className="p-6 sm:p-10" aria-busy="true" aria-label="Generating summary">
    <p className="mb-6 text-sm text-muted-foreground">Retrieving the most relevant passages…</p>
    <div className="max-w-prose space-y-8">
      {[["w-full", "w-11/12", "w-4/5"], ["w-1/3"], ["w-full", "w-10/12", "w-full", "w-2/3"]].map((lines, block) => (
        <div key={block} className="space-y-3">
          {lines.map((width, index) => (
            <Skeleton key={index} className={`${width} ${lines.length === 1 ? "h-5" : "h-4"}`} />
          ))}
        </div>
      ))}
    </div>
  </Card>
);

const SummaryView = ({ documents }: SummaryViewProps) => {
  const [summary, setSummary] = useState("");
  const [telemetry, setTelemetry] = useState<Telemetry>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const request = useAbortController();
  const { toast } = useToast();
  const canGenerate = documents.length > 0 && !isGenerating;

  const handleGenerate = async () => {
    if (documents.length === 0) {
      toast({ title: "No documents uploaded", description: "Please upload a document first", variant: "destructive" });
      return;
    }

    setSummary("");
    setTelemetry(undefined);
    setStopped(false);
    setError(null);
    setIsGenerating(true);
    const renderText = frameBatched(setSummary);
    try {
      const result = await streamCompletion(
        API_CONFIG.ENDPOINTS.SUMMARIZE_STREAM,
        { document_name: null }, // Use all current session documents
        { signal: request.begin(), onText: renderText },
      );
      renderText.flush();
      setSummary(result.text);
      setTelemetry(result.telemetry);
    } catch (err) {
      renderText.flush(); // keep any partial text
      if (isAbortError(err)) setStopped(true);
      else setError(errorText(err, "Failed to generate summary."));
    } finally {
      setIsGenerating(false);
    }
  };

  useHotkey({ key: "Enter", mod: true }, handleGenerate, { enabled: canGenerate });
  useHotkey({ key: "Escape" }, request.abort, { enabled: isGenerating });

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    toast({ title: "Copied!", description: "Summary copied to clipboard" });
  };

  const handleDownload = () => {
    if (!summary || !contentRef.current) return;
    try {
      printSummary(contentRef.current.innerHTML);
      toast({ title: "PDF download ready!", description: "Use your browser's print dialog to save as PDF" });
    } catch (err) {
      console.error("Error downloading summary:", err);
      toast({ title: "Download failed", description: "There was an error preparing the PDF download", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        title="Document summary"
        description="Generate a structured summary of your session documents"
        actions={
          isGenerating ? (
            <Button variant="outline" onClick={request.abort} className="w-full sm:w-auto">
              <Loader2 className="animate-spin" />
              Stop
              <Kbd className="ml-1">Esc</Kbd>
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full sm:w-auto">
              <FileText />
              {summary ? "Regenerate" : "Generate summary"}
              <Kbd className="ml-1 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80">
                {MOD_KEY_LABEL} ↵
              </Kbd>
            </Button>
          )
        }
      />

      {error && <InlineError className="mb-6" title="Couldn't generate the summary" message={error} onRetry={handleGenerate} />}
      {stopped && (
        <InlineError className="mb-6" tone="muted" title="Generation stopped" message={summary ? "Showing the partial summary." : undefined} onRetry={handleGenerate} retryLabel="Regenerate" />
      )}

      {isGenerating && !summary ? (
        <SummarySkeleton />
      ) : summary ? (
        <Card className="p-6 sm:p-10 animate-fade-up">
          <div className="mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">Summary</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={isGenerating}>
                <Copy />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={isGenerating}>
                <Download />
                Download PDF
              </Button>
            </div>
          </div>

          <div ref={contentRef} className="max-w-prose">
            <Markdown content={summary} streaming={isGenerating} />
          </div>

          {telemetry && <TelemetryPanel telemetry={telemetry} className="mt-8" />}

          {!isGenerating && (
            <div className="mt-8 flex items-center justify-between border-t pt-6">
              <Button variant="outline">Chat about this summary</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSummary("")}>
                <X />
                Clear
              </Button>
            </div>
          )}
        </Card>
      ) : (
        !error &&
        !stopped && (
          <Card>
            <EmptyState
              icon={FileText}
              title={documents.length > 0 ? "No summary yet" : "No documents yet"}
              description={
                documents.length > 0
                  ? "Generate a summary to get an overview of your document's main topics and key ideas."
                  : "Upload a PDF from the sidebar to generate a summary."
              }
            >
              {documents.length > 0 && (
                <div className="mx-auto grid max-w-2xl gap-3 text-left sm:grid-cols-3">
                  {SUMMARY_SECTIONS.map(([title, description]) => (
                    <div key={title} className="rounded-lg border bg-muted/30 p-4">
                      <h4 className="text-sm font-medium">{title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              )}
            </EmptyState>
          </Card>
        )
      )}
    </div>
  );
};

export default SummaryView;
