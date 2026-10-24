import type { ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useCopy } from "@/hooks/use-copy";

interface CodeBlockProps {
  language?: string;
  /** Raw source, used for copying (children are the highlighted nodes). */
  code: string;
  children: ReactNode;
}

const CodeBlock = ({ language, code, children }: CodeBlockProps) => {
  const { copied, copy } = useCopy();

  return (
    <div className="not-prose group my-4 overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{language || "text"}</span>
        <button
          type="button"
          onClick={() => copy(code)}
          className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[0.8125rem] leading-relaxed">
        <code className="hljs font-mono">{children}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
