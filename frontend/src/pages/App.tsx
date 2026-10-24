import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileText, HelpCircle, FolderOpen, Home, Sparkles, RefreshCw, BarChart3, Mic, Menu, X, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import API_CONFIG from "@/lib/api";
import { errorText, requestJson } from "@/lib/http";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorBoundary from "@/components/app/ErrorBoundary";
import ChatView from "@/components/app/chat/ChatView";
import SummaryView from "@/components/app/SummaryView";
import QuizView from "@/components/app/QuizView";
import DocumentsView from "@/components/app/DocumentsView";
import UploadSection from "@/components/app/UploadSection";
import AnalyticsDashboard from "@/components/app/AnalyticsDashboard";
import VoiceChat from "@/components/app/VoiceChat";
import ThemeToggle from "@/components/theme/ThemeToggle";

type Tab = "chat" | "summary" | "voice" | "quiz" | "analytics" | "documents";

const NAV_ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "summary", label: "Summary", icon: FileText },
  { id: "voice", label: "Voice Chat", icon: Mic },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "documents", label: "My Documents", icon: FolderOpen },
];

const AppPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [documents, setDocuments] = useState<string[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleUploadSuccess = (filename: string) => {
    setDocuments(prev => [...prev, filename]);
    // Refresh current session documents
    fetchCurrentSessionDocuments();
  };

  const handleDeleteDocument = (filename: string) => {
    setDocuments(prev => prev.filter(doc => doc !== filename));
    // Refresh current session documents
    fetchCurrentSessionDocuments();
  };

  const fetchCurrentSessionDocuments = async () => {
    setDocumentsError(null);
    try {
      const data = await requestJson<{ documents?: string[] }>(API_CONFIG.ENDPOINTS.CURRENT_SESSION_DOCUMENTS);
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Error fetching current session documents:", error);
      setDocumentsError(errorText(error, "Couldn't load session documents"));
    } finally {
      setDocumentsLoading(false);
    }
  };

  // Fetch current session documents on component mount
  useEffect(() => {
    fetchCurrentSessionDocuments();
  }, []);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top Navigation */}
      <header className="z-50 h-14 shrink-0 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                className="-ml-2 h-9 w-9"
              >
                {sidebarOpen ? <X /> : <Menu />}
              </Button>
            )}
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-[0.9375rem] font-semibold">LearnMate AI</h1>
          </div>

          <div className="flex items-center gap-1">
            <span className="mr-2 hidden rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground sm:inline-block">
              {documentsLoading ? "Loading…" : `${documents.length} ${documents.length === 1 ? "document" : "documents"} in session`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCurrentSessionDocuments}
              title="Refresh current session documents"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Home />
              <span className="hidden sm:inline">Home</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Mobile Overlay */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "w-72 shrink-0 overflow-y-auto border-r bg-sidebar",
            isMobile &&
              `fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`,
          )}
        >
          <div className="space-y-8 p-5">
            {isMobile && (
              <div className="flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                  <X />
                </Button>
              </div>
            )}

            <UploadSection onUploadSuccess={handleUploadSuccess} />

            <nav className="space-y-1">
              <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Workspace</h3>
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => selectTab(id)}
                  aria-current={activeTab === id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeTab === id
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4", activeTab === id && "text-primary")} />
                  {label}
                </button>
              ))}
            </nav>

            {documentsLoading && (
              <div className="space-y-2 px-3" aria-busy="true">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            )}

            {!documentsLoading && documents.length > 0 && (
              <div className="space-y-2">
                <h3 className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent Documents</h3>
                <ul className="space-y-0.5">
                  {documents.slice(0, 5).map((doc, index) => (
                    <li key={index} className="flex items-center gap-2.5 truncate rounded-md px-3 py-1.5 text-sm text-muted-foreground" title={doc}>
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
            {/* Keyed so switching tabs clears a crashed view */}
            <ErrorBoundary key={activeTab} variant="section">
              {activeTab === "chat" && <ChatView documents={documents} />}
              {activeTab === "summary" && <SummaryView documents={documents} />}
              {activeTab === "quiz" && <QuizView documents={documents} />}
              {activeTab === "documents" && (
                <DocumentsView
                  documents={documents}
                  isLoading={documentsLoading}
                  error={documentsError}
                  onRetry={fetchCurrentSessionDocuments}
                  onDelete={handleDeleteDocument}
                  onNavigateToChat={() => setActiveTab("chat")}
                />
              )}
              {activeTab === "analytics" && <AnalyticsDashboard />}
              {activeTab === "voice" && <VoiceChat documents={documents} />}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppPage;
