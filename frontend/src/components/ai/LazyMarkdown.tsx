import { lazy, Suspense } from "react";
import type { MarkdownProps } from "./Markdown";

// react-markdown + highlight.js are ~half the bundle; load them with the first AI output
const Markdown = lazy(() => import("./Markdown"));

/** Markdown renderer that code-splits its dependencies, showing plain text until they load. */
const LazyMarkdown = (props: MarkdownProps) => (
  <Suspense fallback={<div className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{props.content}</div>}>
    <Markdown {...props} />
  </Suspense>
);

export default LazyMarkdown;
