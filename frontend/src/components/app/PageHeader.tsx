import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

/** Consistent title block for every app view. */
const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0 space-y-1.5">
      <h2 className="text-2xl font-semibold sm:text-[1.75rem]">{title}</h2>
      {description && <p className="text-sm text-muted-foreground sm:text-[0.9375rem]">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
