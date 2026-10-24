import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import IconBadge from "@/components/app/IconBadge";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Primary call to action, e.g. a Button. */
  action?: ReactNode;
  /** Extra content below the description, e.g. suggestions. */
  children?: ReactNode;
  tone?: "neutral" | "primary";
  className?: string;
}

const EmptyState = ({ icon, title, description, action, children, tone = "neutral", className }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
    <IconBadge icon={icon} size="lg" tone={tone} />
    <h3 className="mt-5 text-lg font-semibold">{title}</h3>
    {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
    {children && <div className="mt-8 w-full">{children}</div>}
  </div>
);

export default EmptyState;
