import { useState } from "react";
import { FileText, Trash2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import API_CONFIG from "@/lib/api";
import { errorText, fetchChecked } from "@/lib/http";
import { resetSessionId } from "@/lib/session";
import { cn } from "@/lib/utils";
import ConfirmDialog from "@/components/app/ConfirmDialog";
import UploadSection from "@/components/app/UploadSection";

export interface NavItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface AppSidebarProps<T extends string> {
  navItems: NavItem<T>[];
  activeTab: T;
  onSelect: (tab: T) => void;
  documents: string[];
  documentsLoading: boolean;
  onUploadSuccess: (filename: string) => void;
  /** Mobile drawer state; undefined on desktop */
  mobileOpen?: boolean;
  onClose: () => void;
}

const sectionHeading = "px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground";

function AppSidebar<T extends string>({ navItems, activeTab, onSelect, documents, documentsLoading, onUploadSuccess, mobileOpen, onClose }: AppSidebarProps<T>) {
  const [confirmClear, setConfirmClear] = useState(false);
  const { toast } = useToast();
  const isMobile = mobileOpen !== undefined;

  /** Erase everything server-side, then start over with a brand-new session id. */
  const clearMyData = async () => {
    try {
      await fetchChecked(API_CONFIG.ENDPOINTS.SESSION, { method: "DELETE" });
      resetSessionId();
      window.location.reload();
    } catch (err) {
      toast({ title: "Couldn't delete your data", description: errorText(err), variant: "destructive" });
    }
  };

  return (
    <aside
      className={cn(
        "flex w-72 shrink-0 flex-col overflow-y-auto border-r bg-sidebar",
        isMobile && `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`,
      )}
    >
      <div className="flex-1 space-y-8 p-5">
        {isMobile && (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
              <X />
            </Button>
          </div>
        )}

        <UploadSection onUploadSuccess={onUploadSuccess} />

        <nav className="space-y-1">
          <h3 className={cn(sectionHeading, "mb-2")}>Workspace</h3>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onSelect(id)}
              aria-current={activeTab === id ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeTab === id ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", activeTab === id && "text-primary")} />
              {label}
            </button>
          ))}
        </nav>

        {documentsLoading ? (
          <div className="space-y-2 px-3" aria-busy="true">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : (
          documents.length > 0 && (
            <div className="space-y-2">
              <h3 className={sectionHeading}>Recent Documents</h3>
              <ul className="space-y-0.5">
                {documents.slice(0, 5).map((doc) => (
                  <li key={doc} className="flex items-center gap-2.5 truncate rounded-md px-3 py-1.5 text-sm text-muted-foreground" title={doc}>
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>

      <div className="border-t p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={() => setConfirmClear(true)}>
          <Trash2 />
          Clear my data
        </Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Delete all your data?"
        description="This permanently deletes your uploaded documents, conversations and learning history from the server, then starts a fresh session."
        confirmLabel="Delete everything"
        destructive
        onConfirm={clearMyData}
      />
    </aside>
  );
}

export default AppSidebar;
