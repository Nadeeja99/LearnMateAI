import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Search, Trash2, MessageSquare, Download, Grid3x3, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentsViewProps {
  documents: string[];
  onDelete: (filename: string) => void;
}

const DocumentsView = ({ documents, onDelete }: DocumentsViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { toast } = useToast();

  const filteredDocuments = documents.filter(doc =>
    doc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (filename: string) => {
    if (window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      try {
        // Call backend API to delete the document
        const response = await fetch(`http://localhost:8000/documents/${encodeURIComponent(filename)}`, {
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">My Documents</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} uploaded
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search documents..."
          className="pl-10"
        />
      </div>

      {/* Documents */}
      {filteredDocuments.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {searchQuery ? "No documents found" : "No documents yet"}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "Try a different search term"
                  : "Upload your first document to get started"}
              </p>
            </div>
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc, index) => (
            <Card key={index} className="p-6 hover:border-primary/50 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              
              <h3 className="font-semibold mb-2 truncate" title={doc}>
                {doc}
              </h3>
              
              <div className="text-sm text-muted-foreground mb-4">
                <p>Uploaded today</p>
                <p>PDF Document</p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <MessageSquare className="h-3 w-3 mr-2" />
                  Chat
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc, index) => (
            <Card key={index} className="p-4 hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold truncate">{doc}</h3>
                    <p className="text-sm text-muted-foreground">Uploaded today • PDF</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsView;
