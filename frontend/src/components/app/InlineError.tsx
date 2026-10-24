import { AlertCircle, CircleSlash, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InlineErrorProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** "muted" for non-failures the user caused, such as a cancelled request. */
  tone?: "error" | "muted";
  className?: string;
}

/** In-place failure panel with an optional retry, used instead of transient toasts. */
const InlineError = ({ title, message, onRetry, retryLabel = "Try again", tone = "error", className }: InlineErrorProps) => {
  const Icon = tone === "error" ? AlertCircle : CircleSlash;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 text-sm animate-fade-up",
        tone === "error" ? "border-destructive/30 bg-destructive/5" : "bg-muted/40",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "error" ? "text-destructive" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {message && <p className="mt-0.5 break-words text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="-my-1 h-8 shrink-0 bg-background">
          <RotateCcw />
          {retryLabel}
        </Button>
      )}
    </div>
  );
};

export default InlineError;
