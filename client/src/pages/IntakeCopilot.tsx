import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, MessageSquare, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { fadeVariants, containerVariants } from "@/lib/animations";
import { useToast } from "@/hooks/use-toast";
import QuickRating from "@/components/QuickRating";
import { IntakeCopilotProgressIndicator } from "@/components/IntakeCopilotProgressIndicator";
import { EmptyState } from "@/components/ui/empty-state";

interface IntakeSession {
  id: string;
  sessionType: string;
  status: string;
  currentStep: string;
  progress: number;
  dataCompleteness: number;
  missingFields: string[];
  messageCount: number;
  extractedData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface IntakeMessage {
  id: string;
  role: string;
  content: string;
  extractedFields: Record<string, any>;
  confidenceScores: Record<string, number>;
  suggestedQuestions: string[];
  createdAt: string;
}

interface BenefitSuggestions {
  eligible: boolean;
  programs: string[];
  summary: string;
}

interface DialogueResponse {
  message: string;
  extractedData?: {
    fields: Record<string, any>;
    confidence: Record<string, number>;
    missingFields: string[];
    completeness: number;
  };
  suggestedQuestions?: string[];
  nextStep?: string;
  shouldGenerateForm?: boolean;
  benefitSuggestions?: BenefitSuggestions;
}

export function IntakeCopilot() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState("");
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [benefitSuggestions, setBenefitSuggestions] = useState<BenefitSuggestions | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<IntakeSession[]>({
    queryKey: ["/api/intake-sessions"],
    enabled: !!user,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<IntakeMessage[]>({
    queryKey: ["/api/intake-sessions", activeSessionId, "messages"],
    enabled: !!activeSessionId,
  });

  const { data: activeSession } = useQuery<IntakeSession>({
    queryKey: ["/api/intake-sessions", activeSessionId],
    enabled: !!activeSessionId,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/intake-sessions", {
        sessionType: "snap_application",
        benefitProgramId: null,
      });
      return response.json();
    },
    onSuccess: (data: IntakeSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/intake-sessions"] });
      setActiveSessionId(data.id);
      toast({
        title: "Session started",
        description: "Let's get your SNAP application started!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", `/api/intake-sessions/${activeSessionId}/messages`, { message });
      return response.json();
    },
    onSuccess: (response: DialogueResponse) => {
      queryClient.invalidateQueries({ queryKey: ["/api/intake-sessions", activeSessionId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/intake-sessions", activeSessionId] });
      
      // Update or clear benefit suggestions based on response
      if (response.benefitSuggestions) {
        setBenefitSuggestions(response.benefitSuggestions);
      } else {
        setBenefitSuggestions(null); // Clear stale suggestions
      }
      
      if (response.shouldGenerateForm) {
        setShowFormDialog(true);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateFormMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/intake-sessions/${activeSessionId}/generate-form`, {}),
    onSuccess: () => {
      toast({
        title: "Application created!",
        description: "Your SNAP application has been generated and saved.",
      });
      setShowFormDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/intake-sessions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!userMessage.trim()) return;
    sendMessageMutation.mutate(userMessage);
    setUserMessage("");
  };

  // Clear benefit suggestions when session changes
  useEffect(() => {
    setBenefitSuggestions(null);
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Alert>
          <MessageSquare className="h-4 w-4" />
          <AlertDescription>
            Please sign in to use the Application Assistant.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <motion.div variants={fadeVariants} initial="hidden" animate="visible">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-intake-copilot">
            Application Assistant
          </h1>
          <p className="text-muted-foreground">
            Let's complete your SNAP application together through conversation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sessions Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Your Sessions
                </CardTitle>
                <CardDescription>
                  Start a new application or continue an existing one
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full mb-4"
                  onClick={() => createSessionMutation.mutate()}
                  disabled={createSessionMutation.isPending}
                  data-testid="button-start-session"
                >
                  {createSessionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <MessageSquare className="h-4 w-4 mr-2" />
                  )}
                  Start New Application
                </Button>

                {sessionsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {sessions.map((session) => (
                        <Card
                          key={session.id}
                          className={`cursor-pointer transition-colors ${
                            activeSessionId === session.id
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/20"
                          }`}
                          onClick={() => setActiveSessionId(session.id)}
                          data-testid={`card-session-${session.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <Badge variant={session.status === "completed" ? "default" : "secondary"}>
                                {session.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(session.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">{session.sessionType.replace("_", " ")}</p>
                            <p className="text-xs text-muted-foreground">{session.messageCount} messages</p>
                            <Progress value={session.progress || 0} className="mt-2" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2 space-y-4">
            {activeSessionId ? (
              <>
                {/* Progress Indicator */}
                {activeSession && (
                  <IntakeCopilotProgressIndicator
                    extractedData={activeSession.extractedData || {}}
                    currentStep={activeSession.currentStep || ""}
                    dataCompleteness={activeSession.dataCompleteness || 0}
                    missingFields={activeSession.missingFields || []}
                  />
                )}

                <Card className="h-[600px] flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Application Conversation
                    </CardTitle>
                    <CardDescription>
                      Ask questions naturally and we'll help you complete your application
                    </CardDescription>
                  </CardHeader>

                <CardContent className="flex-1 flex flex-col overflow-hidden">
                  <ScrollArea className="flex-1 pr-4">
                    {messagesLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-4"
                      >
                        {messages.length === 0 && (
                          <EmptyState
                            icon={MessageSquare}
                            iconColor="gray"
                            title="Start the conversation"
                            description="Send a message below to begin your application!"
                            data-testid="empty-state-messages"
                          />
                        )}
                        {messages.map((message) => (
                          <div key={message.id}>
                            <div
                              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg p-4 ${
                                  message.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                                }`}
                                data-testid={`message-${message.role}-${message.id}`}
                              >
                                <p className="whitespace-pre-wrap">{message.content}</p>
                                {message.role === "assistant" && message.extractedFields && Object.keys(message.extractedFields).length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border/50">
                                    <p className="text-xs font-medium mb-1">Extracted information:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {Object.keys(message.extractedFields).map((field) => (
                                        <Badge key={field} variant="outline" className="text-xs">
                                          {field.replace("_", " ")}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Quick Rating - User feedback on AI responses */}
                            {message.role === "assistant" && (
                              <div className="flex justify-start ml-2 mt-1">
                                <QuickRating
                                  ratingType="intake_copilot"
                                  relatedEntityType="copilot_message"
                                  relatedEntityId={message.id}
                                  containerClassName="scale-90"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {/* Benefit Suggestions Card */}
                        {benefitSuggestions && benefitSuggestions.eligible && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4"
                          >
                            <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                              <div className="ml-2">
                                <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">
                                  You may also qualify for additional benefits!
                                </h4>
                                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                                  Based on the information you've shared, you may be eligible for:
                                </p>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {benefitSuggestions.programs.map((program, idx) => (
                                    <Badge 
                                      key={idx} 
                                      className="bg-green-600 dark:bg-green-700 text-white"
                                      data-testid={`badge-benefit-${idx}`}
                                    >
                                      {program}
                                    </Badge>
                                  ))}
                                </div>
                                <p className="text-xs text-green-700 dark:text-green-300">
                                  We'll help you apply for these benefits after completing your SNAP application.
                                </p>
                              </div>
                            </Alert>
                          </motion.div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </motion.div>
                    )}
                  </ScrollArea>

                  <div className="mt-4 flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sendMessageMutation.isPending}
                      data-testid="input-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!userMessage.trim() || sendMessageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              </>
            ) : (
              <Card className="h-[600px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No session selected</p>
                  <p className="text-sm">Start a new application or select an existing session</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </motion.div>

      {/* Form Generation Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Generate Application Form
            </DialogTitle>
            <DialogDescription>
              We've collected enough information to create your SNAP application form. Would you like to generate it now?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {activeSession && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Application Summary:</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Data completeness: {Math.round((activeSession.dataCompleteness || 0) * 100)}%</p>
                  <p>• Messages exchanged: {activeSession.messageCount}</p>
                  {activeSession.missingFields && activeSession.missingFields.length > 0 && (
                    <p>• Still needed: {activeSession.missingFields.join(", ")}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowFormDialog(false)}>
                Continue Conversation
              </Button>
              <Button
                onClick={() => generateFormMutation.mutate()}
                disabled={generateFormMutation.isPending}
                data-testid="button-generate-form"
              >
                {generateFormMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Form
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
