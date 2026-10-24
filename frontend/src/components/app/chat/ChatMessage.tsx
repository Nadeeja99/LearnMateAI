import { useState } from "react";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";
import { errorText, requestJson } from "@/lib/http";
import { cn } from "@/lib/utils";
import Markdown from "@/components/ai/LazyMarkdown";
import TelemetryPanel from "@/components/ai/TelemetryPanel";
import type { Message } from "./types";

type Rating = "up" | "down";

/** Thumbs up/down, recorded server-side as an `answer_feedback` metric with the answering model. */
function useFeedback(conversationId: string | null | undefined, model: string | undefined) {
  const [rating, setRating] = useState<Rating | null>(null);
  const { toast } = useToast();

  const rate = async (value: Rating) => {
    if (rating === value) return;
    const previous = rating;
    setRating(value); // optimistic
    try {
      await requestJson(API_CONFIG.ENDPOINTS.FEEDBACK, {
        method: "POST",
        json: { rating: value, conversation_id: conversationId ?? undefined, model },
      });
    } catch (err) {
      setRating(previous);
      toast({ title: "Couldn't send feedback", description: errorText(err), variant: "destructive" });
    }
  };
  return { rating, rate };
}

export const ChatMessage = ({ message, conversationId }: { message: Message; conversationId?: string | null }) => {
  const { copied, copy } = useCopy();
  const feedback = useFeedback(conversationId, message.telemetry?.model);
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[90%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground sm:max-w-[80%]">
          <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{message.content}</p>
          <div className="mt-1.5 text-xs text-primary-foreground/70">{new Date(message.timestamp).toLocaleTimeString()}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-up">
      <div className="w-full max-w-[min(92%,48rem)] rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-3 sm:px-5">
        <Markdown content={message.content} streaming={isStreaming} />

        {!isStreaming && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2 border-t pt-2 text-muted-foreground">
              <Button variant="ghost" size="sm" onClick={() => copy(message.content)} className="h-7 px-2 text-xs">
                {copied ? <Check className="!h-3.5 !w-3.5 text-success" /> : <Copy className="!h-3.5 !w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", feedback.rating === "up" && "text-primary")}
                aria-label="Helpful"
                aria-pressed={feedback.rating === "up"}
                onClick={() => feedback.rate("up")}
              >
                <ThumbsUp className={cn("!h-3.5 !w-3.5", feedback.rating === "up" && "fill-current")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-7 w-7", feedback.rating === "down" && "text-destructive")}
                aria-label="Not helpful"
                aria-pressed={feedback.rating === "down"}
                onClick={() => feedback.rate("down")}
              >
                <ThumbsDown className={cn("!h-3.5 !w-3.5", feedback.rating === "down" && "fill-current")} />
              </Button>
              {message.status === "stopped" && (
                <span className="rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium">Partial response</span>
              )}
              <span className="ml-auto text-xs">{new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            {message.telemetry && <TelemetryPanel telemetry={message.telemetry} className="mt-2" />}
          </>
        )}
      </div>
    </div>
  );
};

/** Animated dots shown while waiting for the first token. */
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
