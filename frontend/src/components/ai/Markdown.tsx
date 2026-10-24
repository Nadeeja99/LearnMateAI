import { isValidElement, memo, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import CodeBlock from "./CodeBlock";

interface HastNode {
  type: string;
  value?: string;
  children?: HastNode[];
}

/** Plain text of a hast subtree, used to copy highlighted code verbatim. */
const hastText = (node?: HastNode): string =>
  node ? (node.type === "text" ? node.value ?? "" : (node.children ?? []).map(hastText).join("")) : "";

const components: Components = {
  pre: ({ node, children }) => {
    const codeEl = (isValidElement(children) ? children : null) as ReactElement<{ className?: string; children?: ReactNode }> | null;
    const language = /language-([\w-]+)/.exec(codeEl?.props.className ?? "")?.[1];
    return (
      <CodeBlock language={language} code={hastText(node as HastNode).replace(/\n$/, "")}>
        {codeEl?.props.children ?? children}
      </CodeBlock>
    );
  },
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node: _node, ...props }) => (
    <div className="my-4 overflow-x-auto">
      <table {...props} className="my-0" />
    </div>
  ),
};

export interface MarkdownProps {
  content: string;
  /** Shows a blinking caret after the last block while text is still arriving. */
  streaming?: boolean;
  className?: string;
}

/**
 * Renders model output as GitHub-flavored Markdown. Raw HTML in the source is escaped
 * (no rehype-raw), so model output can't inject markup or scripts.
 */
const Markdown = memo(({ content, streaming = false, className }: MarkdownProps) => (
  <div
    className={cn(
      "prose prose-sm max-w-none break-words text-[0.9375rem] prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-li:my-0.5",
      streaming && "md-streaming",
      className,
    )}
  >
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
));
Markdown.displayName = "Markdown";

export default Markdown;
