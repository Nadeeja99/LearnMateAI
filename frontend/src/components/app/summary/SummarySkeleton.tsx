import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while retrieval runs, before the first summary token arrives. */
const SummarySkeleton = () => (
  <Card className="p-6 sm:p-10" aria-busy="true" aria-label="Generating summary">
    <p className="mb-6 text-sm text-muted-foreground">Retrieving the most relevant passages…</p>
    <div className="max-w-prose space-y-8">
      {[["w-full", "w-11/12", "w-4/5"], ["w-1/3"], ["w-full", "w-10/12", "w-full", "w-2/3"]].map((lines, block) => (
        <div key={block} className="space-y-3">
          {lines.map((width, index) => (
            <Skeleton key={index} className={`${width} ${lines.length === 1 ? "h-5" : "h-4"}`} />
          ))}
        </div>
      ))}
    </div>
  </Card>
);

export default SummarySkeleton;
