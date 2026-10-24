import { useState } from "react";
import { FileText, Grid3x3, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { DocumentDetails } from "@/hooks/use-session-documents";
import API_CONFIG from "@/lib/api";
import { errorText, fetchChecked } from "@/lib/http";
import PageHeader from "@/components/app/PageHeader";
import EmptyState from "@/components/app/EmptyState";
import InlineError from "@/components/app/InlineError";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import { DocumentItem, DocumentsSkeleton } from "@/components/app/documents/DocumentItem";

interface DocumentsViewProps {
  documents: string[];
  details?: Record<string, DocumentDetails>;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDelete: (filename: string) => void;
  onNavigateToChat: () => void;
}

type Layout = "grid" | "list";

const DocumentsView = ({ documents, details = {}, isLoading = false, error = null, onRetry, onDelete, onNavigateToChat }: DocumentsViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [layout, setLayout] = useState<Layout>("grid");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredDocuments = documents.filter((doc) => doc.toLowerCase().includes(searchQuery.toLowerCase()));

  const deleteDocument = async (filename: string) => {
    try {
      await fetchChecked(API_CONFIG.ENDPOINTS.DELETE_DOCUMENT(filename), { method: "DELETE" });
      onDelete(filename);
      toast({ title: "Document deleted", description: `${filename} has been removed` });
    } catch (err) {
      console.error("Error deleting document:", err);
      toast({ title: "Delete failed", description: errorText(err, "Failed to delete document"), variant: "destructive" });
    }
  };

  const layoutButton = (value: Layout, Icon: typeof Grid3x3, label: string) => (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 ${layout === value ? "bg-accent text-foreground" : "text-muted-foreground"}`}
      onClick={() => setLayout(value)}
      aria-label={label}
      aria-pressed={layout === value}
    >
      <Icon />
    </Button>
  );

  const items = filteredDocuments.map((doc) => (
    <DocumentItem
      key={doc}
      name={doc}
      details={details[doc]}
      layout={layout}
      onChat={onNavigateToChat}
      onDelete={() => setPendingDelete(doc)}
    />
  ));

  return (
    <div>
      <PageHeader
        title="My documents"
        description={isLoading ? "Loading documents…" : `${documents.length} ${documents.length === 1 ? "document" : "documents"} uploaded`}
        actions={
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="View mode">
            {layoutButton("grid", Grid3x3, "Grid view")}
            {layoutButton("list", List, "List view")}
          </div>
        }
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search documents…" className="pl-9" />
      </div>

      {error && <InlineError className="mb-6" title="Couldn't load documents" message={error} onRetry={onRetry} />}

      {isLoading ? (
        <DocumentsSkeleton layout={layout} />
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <EmptyState
            icon={searchQuery ? Search : FileText}
            title={searchQuery ? "No documents found" : "No documents yet"}
            description={searchQuery ? `Nothing matches "${searchQuery}". Try a different search term.` : "Upload a PDF from the sidebar to get started."}
            action={
              searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              )
            }
          />
        </Card>
      ) : layout === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items}</div>
      ) : (
        <Card className="divide-y">{items}</Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete document?"
        description={
          <>
            <span className="font-medium text-foreground">{pendingDelete}</span> will be removed from this session. Answers will no
            longer use it. This can't be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => (pendingDelete ? deleteDocument(pendingDelete) : undefined)}
      />
    </div>
  );
};

export default DocumentsView;
