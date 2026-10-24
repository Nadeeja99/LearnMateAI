import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import IconBadge from "@/components/app/IconBadge";

export const StatCard = ({ title, value, icon, subtitle }: { title: string; value: string | number; icon: LucideIcon; subtitle?: string }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <IconBadge icon={icon} size="sm" />
    </div>
  </Card>
);

export const BarList = ({ title, rows }: { title: string; rows: [string, number][] }) => {
  const maxValue = Math.max(1, ...rows.map(([, value]) => value));
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="mb-5 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet</p>
      ) : (
        <div className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 truncate capitalize text-muted-foreground">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(value / maxValue) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-medium tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

/** Mirrors the stat grid + bar lists layout while analytics load. */
export const AnalyticsSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-28" />
        </Card>
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }, (_, index) => (
        <Card key={index} className="space-y-4 p-6">
          <Skeleton className="mb-2 h-4 w-40" />
          {Array.from({ length: 5 }, (_, row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-1.5 flex-1" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </Card>
      ))}
    </div>
  </div>
);
