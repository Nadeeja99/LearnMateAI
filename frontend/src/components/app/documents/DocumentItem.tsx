import { FileText, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import IconBadge from "@/components/app/IconBadge";
import type { DocumentDetails } from "@/hooks/use-session-documents";

interface DocumentItemProps {
  name: string;
  details?: DocumentDetails;
  layout: "grid" | "list";
  onChat: () => void;
  onDelete: () => void;
}

/** "PDF · 12 chunks · Oct 24" from the server's real metadata */
const describe = (details?: DocumentDetails) =>
  [
    "PDF",
    details && `${details.chunks_count} ${details.chunks_count === 1 ? "chunk" : "chunks"}`,
    details?.uploaded_at && new Date(details.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  ]
    .filter(Boolean)
    .join(" · ");

export const DocumentItem = ({ name, details, layout, onChat, onDelete }: DocumentItemProps) => {
  const deleteButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDelete}
      className={
        layout === "grid"
          ? "h-8 w-8 text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
          : "h-9 w-9 text-muted-foreground hover:text-destructive"
      }
      aria-label={`Delete ${name}`}
    >
      <Trash2 />
    </Button>
  );

  if (layout === "list") {
    return (
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <IconBadge icon={FileText} size="sm" />
          <div className="min-w-0">
            <h3 className="truncate font-medium">{name}</h3>
            <p className="text-sm text-muted-foreground">{describe(details)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onChat}>
            <MessageSquare />
            <span className="hidden sm:inline">Chat</span>
          </Button>
          {deleteButton}
        </div>
      </div>
    );
  }

  return (
    <Card className="group p-5 transition-colors hover:border-foreground/20">
      <div className="mb-5 flex items-start justify-between">
        <IconBadge icon={FileText} />
        {deleteButton}
      </div>
      <h3 className="truncate font-medium" title={name}>
        {name}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{describe(details)}</p>
      <Button variant="outline" size="sm" className="mt-5 w-full" onClick={onChat}>
        <MessageSquare />
        Chat
      </Button>
    </Card>
  );
};

export const DocumentsSkeleton = ({ layout }: { layout: "grid" | "list" }) =>
  layout === "grid" ? (
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
