import { useState } from 'react';
import { Send, Loader2, Calculator, X, ChevronDown, ChevronUp, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TaxRule {
  ruleType: 'eligibility' | 'calculation' | 'requirement' | 'exception' | 'procedure';
  topic: string;
  condition?: string;
  action?: string;
  value?: string;
  reference?: string;
}

interface VitaSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  relevanceScore: number;
  extractedRules: TaxRule[];
  topics: string[];
  summary: string;
  citation: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answer?: string;
  results?: VitaSearchResult[];
}

interface VITAChatWidgetProps {
  compact?: boolean;
  onClose?: () => void;
}

export function VITAChatWidget({ compact = false, onClose }: VITAChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest('POST', '/api/vita/search', {
        query,
        topK: 5,
        minScore: 0.7,
        includeAnswer: true
      });
      return response.json();
    },
    onSuccess: (data, query) => {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: query,
        answer: data.answer || 'No answer could be generated from the available information.',
        results: data.results || []
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      console.error('VITA search error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error searching the VITA knowledge base. Please try again.',
        results: []
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || searchMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    searchMutation.mutate(inputValue);
    setInputValue('');
  };

  const handleQuickQuestion = (question: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: question
    };
    setMessages(prev => [...prev, userMessage]);
    searchMutation.mutate(question);
  };

  const vitaQuickQuestions = [
    'Can this Maryland client claim EITC?',
    'What are the EITC income limits for 2024?',
    'What filing status applies to a single parent?',
    'What are the standard deduction amounts?',
    'Can a college student with work-study claim EITC?'
  ];

  const getRuleTypeColor = (ruleType: string) => {
    switch (ruleType) {
      case 'eligibility': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'calculation': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'requirement': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'exception': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'procedure': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (!isOpen) {
    if (compact) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2"
          data-testid="button-open-vita-chat-compact"
        >
          <Calculator className="h-4 w-4" />
          Ask VITA Question
        </Button>
      );
    }
    
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full shadow-lg h-14 w-14 p-0 bg-blue-600 hover:bg-blue-700"
          data-testid="button-open-vita-chat"
        >
          <Calculator className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[600px] max-w-[calc(100vw-3rem)]" data-testid="vita-chat-widget">
      <Card className="shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">VITA Tax Assistant</CardTitle>
              <Badge variant="outline" className="text-xs">
                Federal
              </Badge>
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
                onClick={() => {
                  setIsOpen(false);
                  onClose?.();
                }}
                data-testid="button-close-vita-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="space-y-4">
            {/* Quick Questions */}
            {messages.length === 0 && (
              <div className="space-y-2" data-testid="vita-quick-questions">
                <p className="text-sm text-muted-foreground">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {vitaQuickQuestions.map((question, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickQuestion(question)}
                      className="text-xs"
                      data-testid={`button-quick-question-${idx}`}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.length > 0 && (
              <ScrollArea className="h-96" data-testid="vita-messages-area">
                <div className="space-y-4 pr-4">
                  {messages.map((message) => (
                    <div key={message.id} data-testid={`message-${message.role}`}>
                      {message.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                            <p className="text-sm">{message.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* AI Answer */}
                          {message.answer && (
                            <div className="bg-muted rounded-lg p-4">
                              <p className="text-sm whitespace-pre-wrap">{message.answer}</p>
                            </div>
                          )}

                          {/* Extracted Rules */}
                          {message.results && message.results.length > 0 && (
                            <div className="space-y-3">
                              <Separator />
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <p className="text-xs font-medium text-muted-foreground">
                                  IRS Pub 4012 References ({message.results.length})
                                </p>
                              </div>
                              
                              {message.results.map((result, idx) => (
                                <div
                                  key={result.chunkId}
                                  className="border rounded-lg p-3 space-y-2"
                                  data-testid={`result-${idx}`}
                                >
                                  {/* Citation */}
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-xs">
                                      {result.citation}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {(result.relevanceScore * 100).toFixed(0)}% match
                                    </Badge>
                                  </div>

                                  {/* Topics */}
                                  {result.topics.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {result.topics.map((topic, topicIdx) => (
                                        <Badge
                                          key={topicIdx}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {topic}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  {/* Extracted Tax Rules */}
                                  {result.extractedRules.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium">Extracted Tax Rules:</p>
                                      {result.extractedRules.map((rule, ruleIdx) => (
                                        <div
                                          key={ruleIdx}
                                          className={`rounded p-2 text-xs space-y-1 ${getRuleTypeColor(rule.ruleType)}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold">{rule.topic}</span>
                                            <span className="text-xs opacity-75 uppercase">{rule.ruleType}</span>
                                          </div>
                                          {rule.condition && (
                                            <p><span className="font-medium">If:</span> {rule.condition}</p>
                                          )}
                                          {rule.action && (
                                            <p><span className="font-medium">Then:</span> {rule.action}</p>
                                          )}
                                          {rule.value && (
                                            <p><span className="font-medium">Value:</span> {rule.value}</p>
                                          )}
                                          {rule.reference && (
                                            <p className="opacity-75">Ref: {rule.reference}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Summary */}
                                  {result.summary && (
                                    <p className="text-xs text-muted-foreground italic">
                                      {result.summary}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {searchMutation.isPending && (
                    <div className="flex items-center gap-2 text-muted-foreground" data-testid="loading-indicator">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-sm">Searching IRS Pub 4012...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2" data-testid="vita-search-form">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about federal tax rules..."
                disabled={searchMutation.isPending}
                className="flex-1"
                data-testid="input-vita-query"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim() || searchMutation.isPending}
                data-testid="button-submit-vita-query"
              >
                {searchMutation.isPending ? (
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
