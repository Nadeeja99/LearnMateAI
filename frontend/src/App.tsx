import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import ErrorBoundary from "./components/app/ErrorBoundary";

// Route-level code splitting keeps the landing page from loading the app's AI/Markdown code
const Landing = lazy(() => import("./pages/Landing"));
const AppPage = lazy(() => import("./pages/App"));
const NotFound = lazy(() => import("./pages/NotFound"));

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="learnmate-theme" disableTransitionOnChange>
    <Toaster />
    <ErrorBoundary variant="page">
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<AppPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;
