import { useState } from 'react';
import { Send, Loader2, BookOpen, Search, Filter, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

export default function VitaKnowledgeBase() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topK, setTopK] = useState(5);
  const [minScore, setMinScore] = useState(0.7);

  // Fetch available topics
  const { data: topicsData } = useQuery<{ topics: string[] }>({
    queryKey: ['/api/vita/topics'],
  });

  const availableTopics = topicsData?.topics || [];

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest('POST', '/api/vita/search', {
        query,
        topK,
        minScore,
        topics: selectedTopics.length > 0 ? selectedTopics : undefined,
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
      // console.error('VITA search error:', error);
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
    'Can a client claim EITC if they have investment income?',
    'What are the EITC income limits for 2024?',
    'What filing status applies to a single parent with custody?',
    'What are the standard deduction amounts for 2024?',
    'Can a college student with work-study income claim EITC?',
    'What is the Additional Child Tax Credit (ACTC)?',
    'How do I calculate self-employment tax?',
    'What documentation is needed for Head of Household status?'
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

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const clearFilters = () => {
    setSelectedTopics([]);
    setTopK(5);
    setMinScore(0.7);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="heading-page-title">
            VITA Tax Knowledge Base
          </h1>
        </div>
        <p className="text-muted-foreground">
          Search IRS Publication 4012 and federal tax rules to assist with tax preparation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Search Filters
                </CardTitle>
                {(selectedTopics.length > 0 || topK !== 5 || minScore !== 0.7) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Number of Results */}
              <div className="space-y-2">
                <Label>Number of Results</Label>
                <Select value={topK.toString()} onValueChange={(v) => setTopK(parseInt(v))}>
                  <SelectTrigger data-testid="select-top-k">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 results</SelectItem>
                    <SelectItem value="5">5 results</SelectItem>
                    <SelectItem value="10">10 results</SelectItem>
                    <SelectItem value="15">15 results</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Relevance Score */}
              <div className="space-y-2">
                <Label>Minimum Relevance</Label>
                <Select value={minScore.toString()} onValueChange={(v) => setMinScore(parseFloat(v))}>
                  <SelectTrigger data-testid="select-min-score">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">50% match</SelectItem>
                    <SelectItem value="0.6">60% match</SelectItem>
                    <SelectItem value="0.7">70% match</SelectItem>
                    <SelectItem value="0.8">80% match</SelectItem>
                    <SelectItem value="0.9">90% match</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Topics Filter */}
              {availableTopics.length > 0 && (
                <div className="space-y-2">
                  <Label>Filter by Topic</Label>
                  <ScrollArea className="h-48">
                    <div className="space-y-2 pr-4">
                      {availableTopics.map((topic: string) => (
                        <div key={topic} className="flex items-center space-x-2">
                          <Checkbox
                            id={`topic-${topic}`}
                            checked={selectedTopics.includes(topic)}
                            onCheckedChange={() => handleTopicToggle(topic)}
                            data-testid={`checkbox-topic-${topic}`}
                          />
                          <Label
                            htmlFor={`topic-${topic}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {topic}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {selectedTopics.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Selected Topics ({selectedTopics.length})</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedTopics.map(topic => (
                      <Badge
                        key={topic}
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={() => handleTopicToggle(topic)}
                        data-testid={`badge-selected-topic-${topic}`}
                      >
                        {topic}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Search Panel */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <CardTitle>Search Tax Rules & Guidance</CardTitle>
              </div>
              <CardDescription>
                Ask questions about federal tax law, EITC eligibility, filing requirements, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Input */}
              <form onSubmit={handleSubmit} className="flex gap-2" data-testid="vita-search-form">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about federal tax rules, EITC, filing status, deductions..."
                  disabled={searchMutation.isPending}
                  className="flex-1"
                  data-testid="input-vita-query"
                />
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || searchMutation.isPending}
                  data-testid="button-submit-vita-query"
                >
                  {searchMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </form>

              {/* Quick Questions */}
              {messages.length === 0 && (
                <div className="space-y-3" data-testid="vita-quick-questions">
                  <Label className="text-sm font-medium">Quick Questions:</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {vitaQuickQuestions.map((question, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickQuestion(question)}
                        className="text-xs justify-start h-auto py-2 px-3 whitespace-normal text-left"
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
                <ScrollArea className="h-[600px]" data-testid="vita-messages-area">
                  <div className="space-y-6 pr-4">
                    {messages.map((message) => (
                      <div key={message.id} data-testid={`message-${message.role}`}>
                        {message.role === 'user' ? (
                          <div className="flex justify-end">
                            <div className="bg-primary text-primary-foreground rounded-lg px-4 py-3 max-w-[80%]">
                              <p className="text-sm font-medium">{message.content}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* AI Answer */}
                            {message.answer && (
                              <Card className="bg-muted/50">
                                <CardContent className="pt-4">
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                    {message.answer}
                                  </p>
                                </CardContent>
                              </Card>
                            )}

                            {/* Source Documents */}
                            {message.results && message.results.length > 0 && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <p className="text-sm font-medium text-muted-foreground">
                                    IRS Pub 4012 References ({message.results.length})
                                  </p>
                                </div>

                                {message.results.map((result, idx) => (
                                  <Card key={result.chunkId} data-testid={`result-${idx}`}>
                                    <CardContent className="pt-4 space-y-3">
                                      {/* Citation and Relevance */}
                                      <div className="flex items-center justify-between">
                                        <Badge variant="outline" className="text-xs font-mono">
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
                                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            Extracted Tax Rules
                                          </p>
                                          {result.extractedRules.map((rule, ruleIdx) => (
                                            <div
                                              key={ruleIdx}
                                              className={`rounded-md p-3 text-xs space-y-1.5 ${getRuleTypeColor(rule.ruleType)}`}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span className="font-semibold">{rule.topic}</span>
                                                <Badge variant="outline" className="text-xs uppercase bg-white/50">
                                                  {rule.ruleType}
                                                </Badge>
                                              </div>
                                              {rule.condition && (
                                                <p className="leading-relaxed">
                                                  <span className="font-semibold">If:</span> {rule.condition}
                                                </p>
                                              )}
                                              {rule.action && (
                                                <p className="leading-relaxed">
                                                  <span className="font-semibold">Then:</span> {rule.action}
                                                </p>
                                              )}
                                              {rule.value && (
                                                <p className="leading-relaxed">
                                                  <span className="font-semibold">Value:</span> {rule.value}
                                                </p>
                                              )}
                                              {rule.reference && (
                                                <p className="text-xs opacity-75">Reference: {rule.reference}</p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Summary */}
                                      {result.summary && (
                                        <div className="pt-2 border-t">
                                          <p className="text-xs text-muted-foreground italic leading-relaxed">
                                            {result.summary}
                                          </p>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {searchMutation.isPending && (
                      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg" data-testid="loading-indicator">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div>
                          <p className="text-sm font-medium">Searching IRS Pub 4012...</p>
                          <p className="text-xs text-muted-foreground">
                            Using semantic search to find relevant tax rules
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
