import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, MessageSquare, FileText, HelpCircle, Upload, ArrowRight, Sparkles, Zap, Shield, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import IconBadge from "@/components/app/IconBadge";
import ThemeToggle from "@/components/theme/ThemeToggle";

const features = [
  { icon: Upload, title: "Upload documents", description: "Upload PDFs and let AI understand them instantly" },
  { icon: MessageSquare, title: "Smart chat", description: "Ask questions and get instant, contextual answers" },
  { icon: Mic, title: "Voice chat", description: "Talk naturally with your documents using voice interaction" },
  { icon: FileText, title: "Auto summaries", description: "Generate comprehensive summaries in seconds" },
  { icon: HelpCircle, title: "Quiz generation", description: "Create practice questions automatically" },
];

const steps = [
  { number: "01", title: "Upload your materials", description: "Simply drag and drop your study documents" },
  { number: "02", title: "Ask questions naturally", description: "Chat with your documents using text or voice like talking to a tutor" },
  { number: "03", title: "Get AI-powered insights", description: "Receive instant answers with source references" },
];

const voicePoints = [
  "Natural voice conversation with AI",
  "Real-time speech-to-text and text-to-speech",
  "Continuous listening for hands-free interaction",
  "Perfect for accessibility and multitasking",
];

const principles = [
  { icon: Zap, title: "Fast", description: "Get answers in seconds with an optimized retrieval pipeline" },
  { icon: Shield, title: "Private & secure", description: "Your documents are processed securely and privately" },
  { icon: BookOpen, title: "Grounded", description: "Answers are drawn from your documents, with sources" },
];

const SectionHeading = ({ title, description }: { title: string; description: string }) => (
  <div className="mx-auto mb-14 max-w-2xl text-center">
    <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>
    <p className="mt-4 text-lg text-muted-foreground">{description}</p>
  </div>
);

const Landing = () => {
  const navigate = useNavigate();
  const openApp = () => navigate("/app");

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[0.9375rem] font-semibold">LearnMate AI</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button size="sm" onClick={openApp}>
              Open app
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            AI-powered learning assistant
          </span>

          <h1 className="mt-8 text-4xl font-semibold leading-[1.1] sm:text-6xl">Transform your learning with AI</h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Upload your study materials and get instant answers, summaries, and quizzes. Chat with your documents using
            text or voice.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={openApp}>
              Get started free
              <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
              Learn more
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t py-24 sm:py-32">
        <div className="container">
          <SectionHeading title="Everything you need to learn better" description="Focused tools designed to accelerate your learning" />
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6 transition-colors hover:border-foreground/20">
                <IconBadge icon={feature.icon} tone="primary" />
                <h3 className="mt-5 font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t bg-muted/30 py-24 sm:py-32">
        <div className="container">
          <SectionHeading title="How it works" description="Get started in three simple steps" />
          <ol className="mx-auto grid max-w-5xl gap-10 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.number}>
                <span className="font-mono text-sm font-medium text-primary">{step.number}</span>
                <div className="mt-3 h-px bg-border" />
                <h3 className="mt-6 text-lg font-medium">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Voice Chat Highlight */}
      <section className="border-t py-24 sm:py-32">
        <div className="container grid max-w-6xl items-center gap-16 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <Mic className="h-3.5 w-3.5 text-primary" />
              Voice chat
            </span>
            <h2 className="mt-6 text-3xl font-semibold sm:text-4xl">Talk to your documents</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Speak your questions and get spoken answers grounded in your documents.
            </p>
            <ul className="mt-8 space-y-3">
              {voicePoints.map((point) => (
                <li key={point} className="flex items-center gap-3 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {point}
                </li>
              ))}
            </ul>
            <Button size="lg" className="mt-10" onClick={openApp}>
              Try voice chat
              <ArrowRight />
            </Button>
          </div>

          <Card className="p-6 sm:p-8">
            <div className="space-y-4">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground">
                "Explain the main concepts in chapter 3"
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                AI is responding…
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border bg-muted/40 px-4 py-3">
                "Chapter 3 covers advanced algorithms and their applications in modern computing..."
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t py-24">
        <div className="container grid max-w-5xl gap-10 md:grid-cols-3">
          {principles.map(({ icon: Icon, title, description }) => (
            <div key={title}>
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t py-24 sm:py-32">
        <div className="container max-w-3xl text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">Start learning smarter today</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Upload a document and have your first answer in under a minute.
          </p>
          <Button size="lg" className="mt-10" onClick={openApp}>
            Launch app
            <ArrowRight />
          </Button>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} LearnMate AI</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
