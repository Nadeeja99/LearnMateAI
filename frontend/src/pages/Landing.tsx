import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, MessageSquare, FileText, HelpCircle, Upload, ArrowRight, Sparkles, Zap, Shield, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Upload,
      title: "Upload Documents",
      description: "Upload PDFs and let AI understand them instantly",
    },
    {
      icon: MessageSquare,
      title: "Smart Chat",
      description: "Ask questions and get instant, contextual answers",
    },
    {
      icon: Mic,
      title: "Voice Chat",
      description: "Talk naturally with your documents using voice interaction",
    },
    {
      icon: FileText,
      title: "Auto Summaries",
      description: "Generate comprehensive summaries in seconds",
    },
    {
      icon: HelpCircle,
      title: "Quiz Generation",
      description: "Create practice questions automatically",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Upload Your Materials",
      description: "Simply drag and drop your study documents",
    },
    {
      number: "02",
      title: "Ask Questions Naturally",
      description: "Chat with your documents using text or voice like talking to a tutor",
    },
    {
      number: "03",
      title: "Get AI-Powered Insights",
      description: "Receive instant answers with source references",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-hero)] opacity-20 animate-gradient-shift bg-300%" />
        
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI-Powered Learning Assistant</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Transform Your Learning with AI
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Upload your study materials and get instant answers, summaries, and quizzes. 
              Chat with your documents using text or voice - learning has never been this smart.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                onClick={() => navigate("/app")}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-6 border-primary/30 hover:bg-primary/10"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/30 rounded-full blur-3xl opacity-20" />
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-32 container mx-auto px-4">
        <div className="text-center mb-16 animate-fade-up">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything You Need to Learn Better
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to accelerate your learning journey
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="p-6 bg-card border-border hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] group animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-32 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-up">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div 
                key={index}
                className="relative animate-fade-up"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6 text-3xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="text-2xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
                
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-gradient-to-r from-primary to-secondary opacity-30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Chat Feature Highlight */}
      <section className="py-20 md:py-32 container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Mic className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">New Feature</span>
              </div>
              
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Talk to Your Documents
              </h2>
              
              <p className="text-xl text-muted-foreground mb-8">
                Experience the future of learning with our revolutionary voice chat feature. 
                Simply speak your questions and get instant voice responses from your documents.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Natural voice conversation with AI</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Real-time speech-to-text and text-to-speech</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Continuous listening for hands-free interaction</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Perfect for accessibility and multitasking</span>
                </div>
              </div>
              
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
                onClick={() => navigate("/app")}
              >
                Try Voice Chat Now
                <Mic className="ml-2 h-5 w-5" />
              </Button>
            </div>
            
            <div className="relative animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl blur-3xl" />
                <Card className="relative p-8 bg-card/80 backdrop-blur-sm border-border">
                  <div className="text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
                      <Mic className="h-10 w-10 text-white" />
                    </div>
                    
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <p className="text-sm text-muted-foreground mb-2">You said:</p>
                        <p className="text-foreground">"Explain the main concepts in chapter 3"</p>
                      </div>
                      
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          <span className="text-sm text-primary">AI is responding...</span>
                        </div>
                      </div>
                      
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-sm text-muted-foreground mb-2">AI Response:</p>
                        <p className="text-foreground">"Chapter 3 covers advanced algorithms and their applications in modern computing..."</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="py-20 md:py-32 container mx-auto px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          <Card className="p-8 bg-card border-border text-center">
            <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground">Get answers in seconds with our optimized AI engine</p>
          </Card>
          
          <Card className="p-8 bg-card border-border text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Private & Secure</h3>
            <p className="text-muted-foreground">Your documents are processed securely and privately</p>
          </Card>
          
          <Card className="p-8 bg-card border-border text-center">
            <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Smart Learning</h3>
            <p className="text-muted-foreground">AI understands context and provides relevant insights</p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 container mx-auto px-4">
        <Card className="max-w-4xl mx-auto p-12 md:p-16 text-center bg-gradient-to-br from-card to-muted border-primary/20">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Start Learning Smarter Today
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of students who are already learning faster and more effectively with LearnMate AI
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
            onClick={() => navigate("/app")}
          >
            Launch App Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 LearnMate AI. Transform your learning experience.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
