import { useState } from 'react';
import { Send, Loader2, MessageCircle, X, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    sectionNumber: string;
    sectionTitle: string;
    sourceUrl?: string;
    relevanceScore: number;
  }>;
  sources?: Array<{
    documentId: string;
    filename: string;
    content: string;
    relevanceScore: number;
  }>;
}

interface PolicyChatWidgetProps {
  context?: {
    page?: 'document-verification' | 'eligibility' | 'policy-manual' | 'upload';
    documentType?: string;
    requirementId?: string;
  };
  initialQuestion?: string;
  compact?: boolean;
}

export function PolicyChatWidget({ context, initialQuestion, compact = false }: PolicyChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');

  const chatMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest('/api/chat/ask', {
        method: 'POST',
        body: JSON.stringify({
          query,
          context,
          benefitProgramId: null // Can be passed in if needed
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response;
    },
    onSuccess: (data, query) => {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        sources: data.sources || []
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again or contact support if the problem persists.'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(inputValue);
    setInputValue('');
  };

  const handleQuickQuestion = (question: string) => {
    setInputValue(question);
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: question
    };
    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(question);
  };

  // Context-aware quick questions
  const getQuickQuestions = () => {
    if (context?.page === 'document-verification') {
      return [
        'What documents are acceptable for income verification?',
        'How recent does my utility bill need to be?',
        'Can I use a bank statement instead of a pay stub?'
      ];
    } else if (context?.page === 'eligibility') {
      return [
        'What income counts toward SNAP eligibility?',
        'How is my benefit amount calculated?',
        'What deductions can I claim?'
      ];
    } else {
      return [
        'How do I apply for SNAP benefits in Maryland?',
        'What are the income limits for my household size?',
        'What documents do I need to apply?'
      ];
    }
  };

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
        data-testid="button-open-chat-compact"
      >
        <MessageCircle className="h-4 w-4" />
        Ask a Question
      </Button>
    );
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full shadow-lg h-14 w-14 p-0"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]" data-testid="chat-widget">
      <Card className="shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Policy Assistant</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                data-testid="button-toggle-expand"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-3">
            {/* Messages */}
            <ScrollArea className="h-80 pr-4" data-testid="chat-messages">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Ask me anything about Maryland SNAP policies and requirements
                  </p>
                  
                  {/* Quick questions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Quick questions:</p>
                    {getQuickQuestions().map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs justify-start h-auto py-2 px-3"
                        onClick={() => handleQuickQuestion(question)}
                        data-testid={`button-quick-question-${index}`}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      data-testid={`message-${message.role}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        
                        {/* Citations */}
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                            <p className="text-xs font-medium">Policy References:</p>
                            {message.citations.map((citation, idx) => (
                              <div key={idx} className="text-xs">
                                <Badge variant="outline" className="mr-1">
                                  {citation.sectionNumber}
                                </Badge>
                                <span className="text-muted-foreground">
                                  {citation.sectionTitle}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {chatMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about SNAP policies..."
                disabled={chatMutation.isPending}
                className="flex-1"
                data-testid="input-chat-message"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputValue.trim() || chatMutation.isPending}
                data-testid="button-send-message"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
