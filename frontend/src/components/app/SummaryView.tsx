import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, FileText, Copy, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHotkey } from "@/hooks/use-hotkey";
import { useAbortController } from "@/hooks/use-abort-controller";
import API_CONFIG from "@/lib/api";
import { errorText, isAbortError, requestJson } from "@/lib/http";
import { MOD_KEY_LABEL } from "@/lib/keyboard";
import { printSummary } from "@/lib/print-summary";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import InlineError from "@/components/app/InlineError";
import Kbd from "@/components/app/Kbd";

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
    <div className="mb-8 flex items-center justify-between border-b pb-6">
      <Skeleton className="h-6 w-28" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
    <div className="max-w-prose space-y-8">
      {[["w-full", "w-11/12", "w-4/5"], ["w-1/3"], ["w-full", "w-10/12", "w-full", "w-2/3"]].map((lines, block) => (
        <div key={block} className="space-y-3">
          {lines.map((width, index) => (
            <Skeleton key={index} className={`h-4 ${width} ${lines.length === 1 ? "h-5" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  </Card>
);

const SummaryView = ({ documents }: SummaryViewProps) => {
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useAbortController();
  const { toast } = useToast();
  const canGenerate = documents.length > 0 && !isGenerating;

  const handleGenerate = async () => {
    if (documents.length === 0) {
      toast({ title: "No documents uploaded", description: "Please upload a document first", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const data = await requestJson<{ summary: string }>(API_CONFIG.ENDPOINTS.SUMMARIZE, {
        method: "POST",
        signal: request.begin(),
        json: { document_name: null }, // Use all current session documents
      });
      setSummary(data.summary);
    } catch (err) {
      if (!isAbortError(err)) setError(errorText(err, "Failed to generate summary."));
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
    if (!summary) {
      toast({ title: "No summary to download", description: "Please generate a summary first", variant: "destructive" });
      return;
    }
    try {
      printSummary(summary);
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
              Cancel
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

      {isGenerating ? (
        <SummarySkeleton />
      ) : summary ? (
        <Card className="p-6 sm:p-10 animate-fade-up">
          <div className="mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold">Summary</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download />
                Download PDF
              </Button>
            </div>
          </div>

          <div className="max-w-prose whitespace-pre-wrap text-[0.9375rem] leading-7 text-foreground/90">{summary}</div>

          <div className="mt-10 flex items-center justify-between border-t pt-6">
            <Button variant="outline">Chat about this summary</Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setSummary("")}>
              <X />
              Clear
            </Button>
          </div>
        </Card>
      ) : (
        !error && (
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
