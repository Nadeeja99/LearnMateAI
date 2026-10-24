import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileText, HelpCircle, FolderOpen, Home, Sparkles, RefreshCw, BarChart3, Mic, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSessionDocuments } from "@/hooks/use-session-documents";
import ErrorBoundary from "@/components/app/ErrorBoundary";
import AppSidebar, { type NavItem } from "@/components/app/AppSidebar";
import ChatView from "@/components/app/chat/ChatView";
import SummaryView from "@/components/app/SummaryView";
import QuizView from "@/components/app/QuizView";
import DocumentsView from "@/components/app/DocumentsView";
import AnalyticsDashboard from "@/components/app/AnalyticsDashboard";
import VoiceChat from "@/components/app/VoiceChat";
import ThemeToggle from "@/components/theme/ThemeToggle";

type Tab = "chat" | "summary" | "voice" | "quiz" | "analytics" | "documents";

const NAV_ITEMS: NavItem<Tab>[] = [
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // A question handed to the chat view by another view (e.g. "Chat about this summary")
  const [chatDraft, setChatDraft] = useState<{ text: string; id: number } | null>(null);
  const docs = useSessionDocuments();

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    if (isMobile) setSidebarOpen(false);
  };

  const askInChat = (text: string) => {
    setChatDraft({ text, id: Date.now() });
    setActiveTab("chat");
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
              {docs.isLoading ? "Loading…" : `${docs.documents.length} ${docs.documents.length === 1 ? "document" : "documents"} in session`}
            </span>
            <Button variant="ghost" size="sm" onClick={docs.refresh} title="Refresh current session documents" className="text-muted-foreground hover:text-foreground">
              <RefreshCw />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
              <Home />
              <span className="hidden sm:inline">Home</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {isMobile && sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 animate-fade-in" onClick={() => setSidebarOpen(false)} />}

        <AppSidebar
          navItems={NAV_ITEMS}
          activeTab={activeTab}
          onSelect={selectTab}
          documents={docs.documents}
          documentsLoading={docs.isLoading}
          onUploadSuccess={docs.added}
          mobileOpen={isMobile ? sidebarOpen : undefined}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
            {/* Keyed so switching tabs clears a crashed view */}
            <ErrorBoundary key={activeTab} variant="section">
              {activeTab === "chat" && <ChatView documents={docs.documents} draft={chatDraft} />}
              {activeTab === "summary" && <SummaryView documents={docs.documents} onAskInChat={askInChat} />}
              {activeTab === "quiz" && <QuizView documents={docs.documents} />}
              {activeTab === "documents" && (
                <DocumentsView
                  documents={docs.documents}
                  details={docs.details}
                  isLoading={docs.isLoading}
                  error={docs.error}
                  onRetry={docs.refresh}
                  onDelete={docs.removed}
                  onNavigateToChat={() => setActiveTab("chat")}
                />
              )}
              {activeTab === "analytics" && <AnalyticsDashboard />}
              {activeTab === "voice" && <VoiceChat documents={docs.documents} />}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppPage;
