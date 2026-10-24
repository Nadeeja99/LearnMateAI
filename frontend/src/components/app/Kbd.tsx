import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Inline keyboard key hint. */
const Kbd = ({ children, className }: { children: ReactNode; className?: string }) => (
  <kbd
    className={cn(
      "inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted/60 px-1 font-sans text-[0.6875rem] font-medium text-muted-foreground",
      className,
    )}
  >
    {children}
  </kbd>
);

export default Kbd;
