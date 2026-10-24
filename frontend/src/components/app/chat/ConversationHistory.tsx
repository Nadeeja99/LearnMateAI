import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import InlineError from "@/components/app/InlineError";
import type { Conversation } from "./types";

interface ConversationHistoryProps {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  currentId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onClose: () => void;
}

const ConversationHistory = ({ conversations, isLoading, error, currentId, onSelect, onRetry, onClose }: ConversationHistoryProps) => (
  <Card className="mb-4 p-4 animate-fade-up">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-medium">Previous conversations</h3>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close history">
        <X />
      </Button>
    </div>

    {error ? (
      <InlineError title="Couldn't load conversations" message={error} onRetry={onRetry} />
    ) : (
      <ScrollArea className="h-40">
        <div className="space-y-1 pr-3">
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-1.5 px-3 py-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}

          {!isLoading &&
            conversations.map((conv) => (
              <button
                key={conv.id}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  conv.id === currentId ? "bg-accent" : "hover:bg-accent/60",
                )}
                onClick={() => onSelect(conv.id)}
              >
                <div className="truncate text-sm font-medium">{conv.title}</div>
                <div className="text-xs text-muted-foreground">
                  {conv.message_count} messages · {new Date(conv.updated_at).toLocaleDateString()}
                </div>
              </button>
            ))}

          {!isLoading && conversations.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No previous conversations yet</p>
          )}
        </div>
      </ScrollArea>
    )}
  </Card>
);

export default ConversationHistory;
