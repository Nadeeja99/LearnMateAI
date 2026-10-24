import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import IconBadge from "@/components/app/IconBadge";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** "page" fills the viewport (app root); "section" renders a card in place (a single view). */
  variant?: "page" | "section";
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors so one broken view doesn't blank the whole app. */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isPage = this.props.variant === "page";
    const content = (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <IconBadge icon={AlertTriangle} size="lg" className="border-destructive/30 bg-destructive/10 text-destructive" />
        <h2 className="mt-5 text-lg font-semibold">{isPage ? "Something went wrong" : "This view hit an error"}</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {isPage ? "An unexpected error stopped the app from rendering." : "The rest of the app still works. You can retry this view."}
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={this.reset}>
            <RotateCcw />
            Try again
          </Button>
          {isPage && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          )}
        </div>
        <details className="mt-8 w-full max-w-md text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none text-center">Technical details</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono">{error.message}</pre>
        </details>
      </div>
    );

    return isPage ? (
      <div className="flex min-h-screen items-center justify-center bg-background">{content}</div>
    ) : (
      <Card>{content}</Card>
    );
  }
}

export default ErrorBoundary;
