import { useState } from 'react';
import { AIIntakeChat } from '@/components/AIIntakeChat';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  Mic, 
  Globe, 
  FileText, 
  Brain,
  Shield,
  Clock,
  Users,
  CheckCircle2,
  ArrowRight,
  Info,
  HeartHandshake,
  Languages,
  Accessibility
} from 'lucide-react';

export function IntakeAssistant() {
  const [showChat, setShowChat] = useState(false);

  const features = [
    {
      icon: <Brain className="w-5 h-5" />,
      title: "Smart AI Assistance",
      description: "Natural conversation with context-aware responses"
    },
    {
      icon: <Mic className="w-5 h-5" />,
      title: "Voice Enabled",
      description: "Speak naturally in your preferred language"
    },
    {
      icon: <Languages className="w-5 h-5" />,
      title: "Multi-Language",
      description: "Support for English, Spanish, Chinese, and Korean"
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Document Intelligence",
      description: "Upload documents for automatic data extraction"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Privacy First",
      description: "Your data is encrypted and secure"
    },
    {
      icon: <Accessibility className="w-5 h-5" />,
      title: "Accessible",
      description: "Built for everyone, including screen readers"
    }
  ];

  const stats = [
    { label: "Average Completion Time", value: "12 mins", trend: "-35%" },
    { label: "User Satisfaction", value: "4.8/5", trend: "+12%" },
    { label: "Languages Supported", value: "4", trend: "New" },
    { label: "Success Rate", value: "94%", trend: "+8%" }
  ];

  if (showChat) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-primary" />
              AI Benefits Assistant
            </h1>
            <p className="text-muted-foreground mt-2">
              Your personal guide to Maryland benefits
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowChat(false)}
            data-testid="button-back"
          >
            Back to Info
          </Button>
        </div>
        
        <AIIntakeChat />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Sparkles className="w-12 h-12 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          AI-Powered Benefits Assistant
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Apply for Maryland benefits with the help of an intelligent assistant that speaks your language 
          and guides you every step of the way
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, idx) => (
          <Card key={idx}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <Badge variant={stat.trend.startsWith('+') ? 'default' : stat.trend === 'New' ? 'secondary' : 'outline'}>
                  {stat.trend}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alert */}
      <Alert className="mb-8">
        <Info className="h-4 w-4" />
        <AlertTitle>New Feature Available</AlertTitle>
        <AlertDescription>
          Our AI assistant now supports voice input in multiple languages. 
          Simply click the microphone button and speak naturally in English, Spanish, Chinese, or Korean.
        </AlertDescription>
      </Alert>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {features.map((feature, idx) => (
          <Card key={idx} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {feature.icon}
                </div>
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Information Tabs */}
      <Tabs defaultValue="how-it-works" className="mb-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="how-it-works">How It Works</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="privacy">Privacy & Security</TabsTrigger>
        </TabsList>
        
        <TabsContent value="how-it-works" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Simple Conversation-Based Application</CardTitle>
              <CardDescription>
                No complex forms to navigate - just have a natural conversation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Start the Conversation</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred language and start chatting with our AI assistant. 
                    You can type or use voice input.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold">Answer Questions Naturally</h4>
                  <p className="text-sm text-muted-foreground">
                    The AI will ask you questions about your household, income, and needs. 
                    Answer in your own words - no need to worry about specific formats.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold">Upload Documents (Optional)</h4>
                  <p className="text-sm text-muted-foreground">
                    If you have documents like pay stubs or ID, you can upload them. 
                    The AI will extract information automatically.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                  4
                </div>
                <div>
                  <h4 className="font-semibold">Review and Submit</h4>
                  <p className="text-sm text-muted-foreground">
                    The AI will compile your information into the required forms. 
                    Review everything and submit when ready.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="benefits" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Why Use the AI Assistant?</CardTitle>
              <CardDescription>
                Making benefits applications accessible to everyone
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Save Time
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Complete applications 70% faster than traditional forms. 
                    The AI remembers your answers and avoids redundant questions.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-primary" />
                    Human-Like Support
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Get the feeling of talking to a knowledgeable counselor who 
                    understands your situation and guides you appropriately.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Language Accessibility
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Communicate in your native language. The assistant understands 
                    and responds in English, Spanish, Chinese, and Korean.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Higher Success Rate
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    AI validation catches errors before submission, significantly 
                    reducing application rejections due to incomplete information.
                  </p>
                </div>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm">
                  <strong>Available Benefits:</strong> SNAP (Food Assistance), Medicaid, 
                  TANF (Cash Assistance), Energy Assistance (OHEP), and more Maryland programs.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="privacy" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Privacy is Our Priority</CardTitle>
              <CardDescription>
                Enterprise-grade security for your sensitive information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">End-to-End Encryption</h4>
                  <p className="text-sm text-muted-foreground">
                    All conversations and documents are encrypted both in transit and at rest.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">HIPAA Compliant</h4>
                  <p className="text-sm text-muted-foreground">
                    Our system meets healthcare privacy standards for handling sensitive data.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">No Data Sharing</h4>
                  <p className="text-sm text-muted-foreground">
                    Your information is only used for your benefit applications and never sold.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold">Right to Delete</h4>
                  <p className="text-sm text-muted-foreground">
                    You can request deletion of your data at any time through your account settings.
                  </p>
                </div>
              </div>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  The AI assistant does not store conversation history beyond your active session 
                  unless you explicitly save your application progress.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CTA Section */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="mb-6 opacity-90">
            Our AI assistant is here to help you apply for the benefits you deserve. 
            Start a conversation now - it's free, secure, and available 24/7.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => setShowChat(true)}
            className="font-semibold"
            data-testid="button-start-chat"
          >
            Start AI Assistant
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-sm mt-4 opacity-75">
            Average completion time: 12 minutes
          </p>
        </CardContent>
      </Card>

      {/* Help Section */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Need help? Call <strong>1-800-XXX-XXXX</strong> or visit your local DHS office.
        </p>
        <p className="mt-2">
          Available Monday-Friday, 8:00 AM - 5:00 PM EST
        </p>
      </div>
    </div>
  );
}