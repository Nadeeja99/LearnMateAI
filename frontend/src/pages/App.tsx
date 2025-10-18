import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, FileText, HelpCircle, FolderOpen, Upload, Home, Sparkles, RefreshCw, BarChart3, Mic, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import API_CONFIG from "@/lib/api";
import ChatView from "@/components/app/ChatView";
import SummaryView from "@/components/app/SummaryView";
import QuizView from "@/components/app/QuizView";
import DocumentsView from "@/components/app/DocumentsView";
import UploadSection from "@/components/app/UploadSection";
import AnalyticsDashboard from "@/components/app/AnalyticsDashboard";
import VoiceChat from "@/components/app/VoiceChat";

const AppPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("chat");
  const [documents, setDocuments] = useState<string[]>([]);
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
    try {
      const response = await fetch(API_CONFIG.ENDPOINTS.CURRENT_SESSION_DOCUMENTS);
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Error fetching current session documents:", error);
    }
  };

  // Fetch current session documents on component mount
  useEffect(() => {
    fetchCurrentSessionDocuments();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-2"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            )}
            
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              LearnMate AI
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchCurrentSessionDocuments}
              title="Refresh current session documents"
              className="hidden sm:flex"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchCurrentSessionDocuments}
              title="Refresh current session documents"
              className="sm:hidden"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
              className="hidden sm:flex"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
              className="sm:hidden"
            >
              <Home className="h-4 w-4" />
            </Button>
            <div className="px-2 sm:px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs sm:text-sm hidden sm:block">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'} in session
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          ${isMobile 
            ? `fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : 'w-80'
          }
          border-r border-border bg-card/30 backdrop-blur-sm overflow-y-auto
        `}>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Mobile Close Button */}
            {isMobile && (
              <div className="flex justify-end mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Upload Section */}
            <UploadSection onUploadSuccess={handleUploadSuccess} />

            {/* Navigation */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Quick Actions</h3>
              
              <Button
                variant={activeTab === "chat" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab("chat");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <MessageSquare className="h-4 w-4 mr-3" />
                Chat
              </Button>
              
              <Button
                variant={activeTab === "summary" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab("summary");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <FileText className="h-4 w-4 mr-3" />
                Generate Summary
              </Button>
              
              <Button
                variant={activeTab === "voice" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab("voice");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <Mic className="h-4 w-4 mr-3" />
                Voice Chat
              </Button>
              
              <Button
                variant={activeTab === "quiz" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab("quiz");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <HelpCircle className="h-4 w-4 mr-3" />
                Create Quiz
              </Button>
              
              <Button
                variant={activeTab === "analytics" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab("analytics");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <BarChart3 className="h-4 w-4 mr-3" />
                Analytics
              </Button>
              
              <Button
                variant={activeTab === "documents" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => {
                  setActiveTab("documents");
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                <FolderOpen className="h-4 w-4 mr-3" />
                My Documents
              </Button>
            </div>

            {/* Uploaded Documents List */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Recent Documents</h3>
                <div className="space-y-2">
                  {documents.slice(0, 5).map((doc, index) => (
                    <div 
                      key={index}
                      className="p-3 rounded-lg bg-muted/50 border border-border text-sm truncate"
                    >
                      📄 {doc}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-6xl">
            {activeTab === "chat" && <ChatView documents={documents} />}
            {activeTab === "summary" && <SummaryView documents={documents} />}
            {activeTab === "quiz" && <QuizView documents={documents} />}
            {activeTab === "documents" && (
              <DocumentsView 
                documents={documents} 
                onDelete={handleDeleteDocument}
                onNavigateToChat={() => setActiveTab("chat")}
              />
            )}
            {activeTab === "analytics" && <AnalyticsDashboard />}
            {activeTab === "voice" && <VoiceChat documents={documents} />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppPage;
