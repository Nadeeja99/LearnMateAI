import { Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Message } from "./types";

interface ChatMessageProps {
  message: Message;
  onCopy: (content: string) => void;
}

export const ChatMessage = ({ message, onCopy }: ChatMessageProps) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex animate-fade-up", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] sm:max-w-[80%]",
          isUser
            ? "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground"
            : "rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-3",
        )}
      >
        <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{message.content}</p>
        <div className={cn("mt-1.5 text-xs", isUser ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>

        {!isUser && (
          <div className="-mb-1 mt-2 flex items-center gap-0.5 border-t pt-2 text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => onCopy(message.content)} className="h-7 px-2 text-xs">
              <Copy className="!h-3.5 !w-3.5" />
              Copy
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Helpful">
              <ThumbsUp className="!h-3.5 !w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Not helpful">
              <ThumbsDown className="!h-3.5 !w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

/** Animated dots shown while waiting for the assistant. */
export const TypingIndicator = () => (
  <div className="flex justify-start animate-fade-up" role="status" aria-label="Assistant is thinking">
    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-4">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  </div>
);

/** Placeholder bubbles while a saved conversation loads. */
export const MessageListSkeleton = () => (
  <div className="space-y-6 p-4 sm:p-6" aria-busy="true" aria-label="Loading conversation">
    {["w-2/5", "w-3/5", "w-1/3", "w-1/2"].map((width, index) => (
      <div key={index} className={cn("flex", index % 2 === 0 ? "justify-end" : "justify-start")}>
        <Skeleton className={cn("h-14 rounded-2xl", width, index % 2 === 0 && "bg-primary/15")} />
      </div>
    ))}
  </div>
);
