import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, FileText, Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";
import PageHeader from "@/components/app/PageHeader";
import IconBadge from "@/components/app/IconBadge";

interface SummaryViewProps {
  documents: string[];
}

const SummaryView = ({ documents }: SummaryViewProps) => {
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (documents.length === 0) {
      toast({
        title: "No documents uploaded",
        description: "Please upload a document first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Get current session documents from backend
      const sessionResponse = await fetch(API_CONFIG.ENDPOINTS.CURRENT_SESSION_DOCUMENTS);
      const sessionData = await sessionResponse.json();
      
      console.log("Current session documents:", sessionData.documents);
      
      const response = await fetch(API_CONFIG.ENDPOINTS.SUMMARIZE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_name: null, // Use all current session documents
          session_documents: sessionData.documents
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        toast({
          title: "Summary generated!",
          description: "Your document summary is ready",
        });
      } else {
        throw new Error("Failed to generate summary");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    toast({
      title: "Copied!",
      description: "Summary copied to clipboard",
    });
  };

  const handleDownload = async () => {
    if (!summary) {
      toast({
        title: "No summary to download",
        description: "Please generate a summary first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      
      document.body.appendChild(iframe);

      // Create the HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Document Summary - LearnMate AI</title>
            <style>
              @page {
                margin: 1in;
                size: A4;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 100%;
                margin: 0;
                padding: 0;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #4f46e5;
              }
              h1 {
                color: #4f46e5;
                margin: 0;
                font-size: 24px;
              }
              .summary-content {
                white-space: pre-wrap;
                background: #fafaf9;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #4f46e5;
                margin: 20px 0;
                font-size: 14px;
                line-height: 1.8;
              }
              .footer {
                margin-top: 40px;
                text-align: center;
                color: #666;
                font-size: 12px;
                border-top: 1px solid #ddd;
                padding-top: 20px;
              }
              @media print {
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .summary-content {
                  background: #fafaf9 !important;
                  border-left: 4px solid #4f46e5 !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Document Summary</h1>
            </div>
            <div class="summary-content">${summary.replace(/\n/g, '<br>')}</div>
            <div class="footer">
              Generated by LearnMate AI on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            </div>
          </body>
        </html>
      `;

      // Write content to the iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Wait for content to load, then trigger print dialog
        iframe.onload = () => {
          setTimeout(() => {
            if (iframe.contentWindow) {
              iframe.contentWindow.print();
              
              // Clean up the iframe after printing
              setTimeout(() => {
                document.body.removeChild(iframe);
              }, 1000);
            }
          }, 500);
        };
      }

      toast({
        title: "PDF download ready!",
        description: "Use your browser's print dialog to save as PDF",
      });
    } catch (error) {
      console.error("Error downloading summary:", error);
      toast({
        title: "Download failed",
        description: "There was an error preparing the PDF download",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Document summary"
        description="Generate a structured summary of your session documents"
        actions={
          <Button onClick={handleGenerate} disabled={isGenerating || documents.length === 0} className="w-full sm:w-auto">
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileText />
                Generate summary
              </>
            )}
          </Button>
        }
      />

      {summary ? (
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

          <div className="max-w-prose whitespace-pre-wrap text-[0.9375rem] leading-7 text-foreground/90">
            {summary}
          </div>

          <div className="mt-10 border-t pt-6">
            <Button variant="outline">Chat about this summary</Button>
          </div>
        </Card>
      ) : (
        <Card className="px-6 py-16">
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <IconBadge icon={FileText} size="lg" className="mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No summary yet</h3>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                {documents.length > 0
                  ? "Generate a summary to get an overview of your document's main topics and key ideas."
                  : "Upload a document first to generate a summary."}
              </p>
            </div>

            {documents.length > 0 && (
              <div className="grid gap-3 pt-2 text-left sm:grid-cols-3">
                {[
                  ["Main topics", "Core subjects covered"],
                  ["Key concepts", "Important ideas"],
                  ["Takeaways", "Essential insights"],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-sm font-medium">{title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default SummaryView;
