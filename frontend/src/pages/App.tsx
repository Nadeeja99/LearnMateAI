import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, FileText, HelpCircle, FolderOpen, Upload, Home, Sparkles, RefreshCw, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ChatView from "@/components/app/ChatView";
import SummaryView from "@/components/app/SummaryView";
import QuizView from "@/components/app/QuizView";
import DocumentsView from "@/components/app/DocumentsView";
import UploadSection from "@/components/app/UploadSection";
import AnalyticsDashboard from "@/components/app/AnalyticsDashboard";

const AppPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("chat");
  const [documents, setDocuments] = useState<string[]>([]);

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
      const response = await fetch("http://localhost:8000/current-session-documents");
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
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              LearnMate AI
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchCurrentSessionDocuments}
              title="Refresh current session documents"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/")}
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'} in session
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 border-r border-border bg-card/30 backdrop-blur-sm overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Upload Section */}
            <UploadSection onUploadSuccess={handleUploadSuccess} />

            {/* Navigation */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Quick Actions</h3>
              
              <Button
                variant={activeTab === "chat" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("chat")}
              >
                <MessageSquare className="h-4 w-4 mr-3" />
                Chat
              </Button>
              
              <Button
                variant={activeTab === "summary" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("summary")}
              >
                <FileText className="h-4 w-4 mr-3" />
                Generate Summary
              </Button>
              
              <Button
                variant={activeTab === "quiz" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("quiz")}
              >
                <HelpCircle className="h-4 w-4 mr-3" />
                Create Quiz
              </Button>
              
              <Button
                variant={activeTab === "documents" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("documents")}
              >
                <FolderOpen className="h-4 w-4 mr-3" />
                My Documents
              </Button>
              
              <Button
                variant={activeTab === "analytics" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("analytics")}
              >
                <BarChart3 className="h-4 w-4 mr-3" />
                Analytics
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
          <div className="container mx-auto px-6 py-8 max-w-6xl">
            {activeTab === "chat" && <ChatView documents={documents} />}
            {activeTab === "summary" && <SummaryView documents={documents} />}
            {activeTab === "quiz" && <QuizView documents={documents} />}
            {activeTab === "documents" && (
              <DocumentsView 
                documents={documents} 
                onDelete={handleDeleteDocument}
              />
            )}
            {activeTab === "analytics" && <AnalyticsDashboard />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppPage;
