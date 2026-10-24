import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Search, Trash2, MessageSquare, Download, Grid3x3, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/app/PageHeader";
import IconBadge from "@/components/app/IconBadge";
import EmptyState from "@/components/app/EmptyState";
import InlineError from "@/components/app/InlineError";

interface DocumentsViewProps {
  documents: string[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDelete: (filename: string) => void;
  onNavigateToChat?: () => void;
}

const DocumentsSkeleton = ({ viewMode }: { viewMode: "grid" | "list" }) =>
  viewMode === "grid" ? (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading documents">
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="mb-5 h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
          <Skeleton className="mt-5 h-9 w-full" />
        </Card>
      ))}
    </div>
  ) : (
    <Card className="divide-y" aria-busy="true" aria-label="Loading documents">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 p-4">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </Card>
  );

const DocumentsView = ({ documents, isLoading = false, error = null, onRetry, onDelete, onNavigateToChat }: DocumentsViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { toast } = useToast();

  const filteredDocuments = documents.filter(doc =>
    doc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatClick = () => {
    if (onNavigateToChat) {
      onNavigateToChat();
    } else {
      toast({
        title: "Navigation not available",
        description: "Please navigate to chat manually",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (filename: string) => {
    if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      try {
        // Call backend API to delete the document
        const response = await fetch(API_CONFIG.ENDPOINTS.DELETE_DOCUMENT(filename), {
          method: "DELETE",
        });

        if (response.ok) {
          // Call parent's onDelete to update frontend state
          onDelete(filename);
          toast({
            title: "Document deleted",
            description: `${filename} has been removed from the system`,
          });
        } else {
          const errorData = await response.json();
          toast({
            title: "Delete failed",
            description: errorData.detail || "Failed to delete document",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error deleting document:", error);
        toast({
          title: "Delete failed",
          description: "Network error while deleting document",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div>
      <PageHeader
        title="My documents"
        description={isLoading ? "Loading documents…" : `${documents.length} ${documents.length === 1 ? "document" : "documents"} uploaded`}
        actions={
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="View mode">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <Grid3x3 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground"}`}
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              <List />
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search documents…"
          className="pl-9"
        />
      </div>

      {error && <InlineError className="mb-6" title="Couldn't load documents" message={error} onRetry={onRetry} />}

      {/* Documents */}
      {isLoading ? (
        <DocumentsSkeleton viewMode={viewMode} />
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <EmptyState
            icon={searchQuery ? Search : FileText}
            title={searchQuery ? "No documents found" : "No documents yet"}
            description={
              searchQuery ? `Nothing matches "${searchQuery}". Try a different search term.` : "Upload a PDF from the sidebar to get started."
            }
            action={
              searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              )
            }
          />
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc, index) => (
            <Card key={index} className="group p-5 transition-colors hover:border-foreground/20">
              <div className="mb-5 flex items-start justify-between">
                <IconBadge icon={FileText} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doc)}
                  className="h-8 w-8 text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  aria-label={`Delete ${doc}`}
                >
                  <Trash2 />
                </Button>
              </div>

              <h3 className="truncate font-medium" title={doc}>
                {doc}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">PDF · Uploaded today</p>

              <div className="mt-5 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handleChatClick}>
                  <MessageSquare />
                  Chat
                </Button>
                <Button variant="outline" size="sm" aria-label={`Download ${doc}`}>
                  <Download />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="divide-y">
          {filteredDocuments.map((doc, index) => (
            <div key={index} className="flex items-center justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <IconBadge icon={FileText} size="sm" />
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{doc}</h3>
                  <p className="text-sm text-muted-foreground">PDF · Uploaded today</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handleChatClick}>
                  <MessageSquare />
                  <span className="hidden sm:inline">Chat</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label={`Download ${doc}`}>
                  <Download />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doc)}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${doc}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default DocumentsView;
