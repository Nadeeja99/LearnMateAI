import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, FileText, Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      const sessionResponse = await fetch("http://localhost:8000/current-session-documents");
      const sessionData = await sessionResponse.json();
      
      console.log("Current session documents:", sessionData.documents);
      
      const response = await fetch("http://localhost:8000/summarize", {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Document Summary</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Generate comprehensive summaries of your documents
          </p>
        </div>
        
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || documents.length === 0}
          size="lg"
          className="bg-gradient-to-r from-primary to-secondary w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Generate Summary
            </>
          )}
        </Button>
      </div>

      {/* Summary Display */}
      {summary ? (
        <Card className="p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-lg sm:text-xl font-semibold">Summary</h3>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs sm:text-sm">
                <Copy className="h-4 w-4 mr-1 sm:mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                <Download className="h-4 w-4 mr-1 sm:mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
          
          <div className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {summary}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <Button variant="outline">
              Chat about this summary
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">No Summary Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {documents.length > 0
                  ? "Click the 'Generate Summary' button to create a comprehensive summary of your document"
                  : "Upload a document first to generate a summary"}
              </p>
            </div>
            
            {documents.length > 0 && (
              <div className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">Your summary will include:</p>
                <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-1">Main Topics</h4>
                    <p className="text-sm text-muted-foreground">Core subjects covered</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-1">Key Concepts</h4>
                    <p className="text-sm text-muted-foreground">Important ideas</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-1">Takeaways</h4>
                    <p className="text-sm text-muted-foreground">Essential insights</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default SummaryView;
