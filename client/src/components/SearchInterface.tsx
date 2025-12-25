import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Bot, Calculator, BookOpen, CheckCircle2, Info, Clock, Sparkles, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { ExportButton } from "@/components/ExportButton";
import FeedbackButton from "@/components/FeedbackButton";
import QuickRating from "@/components/QuickRating";

interface HybridSearchResult {
  answer: string;
  type: 'deterministic' | 'ai_generated' | 'hybrid';
  classification: {
    type: string;
    confidence: number;
    reasoning: string;
  };
  calculation?: {
    eligible: boolean;
    estimatedBenefit?: number;
    reason: string;
    breakdown?: any;
    appliedRules?: string[];
    policyCitations?: Array<{
      sectionNumber: string;
      sectionTitle: string;
      ruleType: string;
      description: string;
    }>;
  };
  aiExplanation?: {
    answer: string;
    sources: Array<{
      documentId: string;
      filename: string;
      content: string;
      relevanceScore: number;
      sectionNumber?: string;
      sectionTitle?: string;
    }>;
    citations?: Array<{
      sectionNumber: string;
      sectionTitle: string;
      sourceUrl?: string;
      relevanceScore: number;
    }>;
    relevanceScore?: number;
  };
  nextSteps?: string[];
  responseTime: number;
}

const RECENT_SEARCHES_KEY = "md-benefits-recent-searches";
const MAX_RECENT_SEARCHES = 5;

export default function SearchInterface() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const [query, setQuery] = useState("");
  const [executedQuery, setExecutedQuery] = useState("");
  const [searchResult, setSearchResult] = useState<HybridSearchResult | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { toast } = useToast();

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        // console.error("Failed to load recent searches:", e);
      }
    }
  }, []);

  // Save recent searches to localStorage
  const addRecentSearch = (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setRecentSearches(prev => {
      // Remove duplicate if exists, add to front, limit to MAX_RECENT_SEARCHES
      const filtered = prev.filter(q => q !== trimmedQuery);
      const updated = [trimmedQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecentSearch = (searchQuery: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(q => q !== searchQuery);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const { data: benefitPrograms = [] } = useQuery({
    queryKey: ["/api/public/benefit-programs"],
  });

  const searchMutation = useMutation({
    mutationFn: async ({ query }: { query: string }) => {
      const response = await apiRequest("POST", "/api/search", { query });
      return response.json();
    },
    onSuccess: (data: HybridSearchResult) => {
      setSearchResult(data);
    },
    onError: (error) => {
      toast({
        title: "Something went wrong",
        description: "We couldn't search right now. Please try again in a moment.",
        variant: "destructive",
      });
      // console.error("Search error:", error);
    },
  });

  const handleSearch = (searchQuery?: string) => {
    const queryToSearch = searchQuery || query;
    if (!queryToSearch.trim()) {
      toast({
        title: "What would you like to know?",
        description: "Please type your question about SNAP benefits.",
        variant: "destructive",
      });
      return;
    }
    addRecentSearch(queryToSearch);
    setExecutedQuery(queryToSearch);
    searchMutation.mutate({ query: queryToSearch });
  };

  const handleQuickSearch = (quickQuery: string) => {
    setQuery(quickQuery);
    handleSearch(quickQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const quickSearches = [
    "Do I qualify with a household of 2 and $2000 monthly income?",
    "How much SNAP benefits can I get?",
    "What is the income limit for SNAP?",
    "Can college students get SNAP?"
  ];

  return (
    <div className="space-y-8">
      <a href="#search-results" className="skip-link">Skip to search results</a>
      
      <section aria-labelledby="search-heading">
        <h2 id="search-heading" className="sr-only">Search {stateName} SNAP Information</h2>
        <Card className="shadow-lg border border-border">
          <CardContent className="p-6">
            <div className="relative">
              <label htmlFor="search-input" className="sr-only">
                Search for SNAP information
              </label>
              <Input 
                id="search-input"
                type="text" 
                placeholder={`Ask about ${stateName} SNAP eligibility, income limits, work rules...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                className="w-full p-3 sm:p-4 pr-12 text-base sm:text-lg"
                data-testid="input-search"
                aria-describedby="search-help"
              />
              <div id="search-help" className="sr-only">
                Type your question about SNAP benefits and press Enter or click Search
              </div>
              <Button 
                onClick={() => handleSearch()}
                disabled={searchMutation.isPending}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                data-testid="button-search"
                aria-label={searchMutation.isPending ? "Searching..." : "Search for SNAP information"}
              >
                {searchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    <span className="sr-only">Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                    Search
                  </>
                )}
              </Button>
            </div>
          
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="mt-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground" id="recent-searches-label">Recent Searches</p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="recent-searches-label">
                {recentSearches.map((search, index) => (
                  <div key={index} className="flex items-center gap-1 bg-muted rounded-md">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => handleQuickSearch(search)}
                      className="rounded-r-none hover:bg-accent/50"
                      data-testid={`button-recent-search-${index}`}
                      aria-label={`Search again for: ${search}`}
                      disabled={searchMutation.isPending}
                    >
                      {search}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRecentSearch(search)}
                      className="px-2 rounded-l-none border-l border-border/50"
                      data-testid={`button-remove-recent-${index}`}
                      aria-label={`Remove from recent searches: ${search}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested For You */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-md-gold" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground" id="suggested-label">Suggested For You</p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="suggested-label">
              {quickSearches.map((search, index) => (
                <Button 
                  key={search}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSearch(search)}
                  data-testid={`button-quick-search-${index}`}
                  aria-label={`Search for: ${search}`}
                  disabled={searchMutation.isPending}
                >
                  {search}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      </section>

      {searchResult && (
        <section id="search-results" aria-labelledby="results-heading">
          <Card className="shadow-lg border border-border slide-up">
            <CardContent className="p-6">
              {/* Result Type Badge and Export Button */}
              <div className="flex items-center gap-2 mb-4 justify-between">
                <div className="flex items-center gap-2">
                {searchResult.type === 'deterministic' && (
                  <>
                    <Calculator className="h-5 w-5 text-primary" />
                    <Badge variant="default" className="bg-primary">Deterministic Calculation</Badge>
                  </>
                )}
                {searchResult.type === 'ai_generated' && (
                  <>
                    <BookOpen className="h-5 w-5 text-accent-foreground" />
                    <Badge variant="secondary">Policy Interpretation</Badge>
                  </>
                )}
                {searchResult.type === 'hybrid' && (
                  <>
                    <Bot className="h-5 w-5 text-primary" />
                    <Badge variant="default">Hybrid Answer</Badge>
                  </>
                )}
                <span className="text-xs text-muted-foreground">
                  {searchResult.responseTime}ms
                </span>
                </div>
                <ExportButton
                  data={(() => {
                    const exportData: any[] = [];
                    
                    if (searchResult.calculation?.policyCitations) {
                      searchResult.calculation.policyCitations.forEach(citation => {
                        exportData.push({
                          type: 'Policy Citation',
                          sectionNumber: citation.sectionNumber,
                          sectionTitle: citation.sectionTitle,
                          ruleType: citation.ruleType,
                          description: citation.description,
                        });
                      });
                    }
                    
                    if (searchResult.aiExplanation?.citations) {
                      searchResult.aiExplanation.citations.forEach(citation => {
                        exportData.push({
                          type: 'AI Citation',
                          sectionNumber: citation.sectionNumber,
                          sectionTitle: citation.sectionTitle,
                          relevanceScore: citation.relevanceScore,
                          sourceUrl: citation.sourceUrl || '—',
                        });
                      });
                    }
                    
                    if (searchResult.aiExplanation?.sources) {
                      searchResult.aiExplanation.sources.forEach((source, idx) => {
                        exportData.push({
                          type: 'Source',
                          filename: source.filename,
                          sectionNumber: source.sectionNumber || '—',
                          sectionTitle: source.sectionTitle || '—',
                          relevanceScore: source.relevanceScore,
                          content: source.content,
                        });
                      });
                    }
                    
                    return exportData.length > 0 ? exportData : [{
                      type: 'Answer',
                      query: query,
                      answer: searchResult.answer,
                      responseType: searchResult.type,
                      responseTime: searchResult.responseTime,
                    }];
                  })()}
                  filename={`snap-search-${new Date().toISOString().split('T')[0]}`}
                  title="SNAP Search Results"
                  columns={[
                    { header: "Type", key: "type" },
                    { header: "Section Number", key: "sectionNumber" },
                    { header: "Section Title", key: "sectionTitle" },
                    { 
                      header: "Relevance Score", 
                      key: "relevanceScore",
                      format: (val) => val ? `${(val * 100).toFixed(0)}%` : '—'
                    },
                    { header: "Description/Content", key: "description" },
                    { header: "Source URL", key: "sourceUrl" },
                  ]}
                  size="sm"
                  variant="outline"
                />
              </div>

              {/* Deterministic Calculation Result */}
              {searchResult.calculation && (
                <Alert className={searchResult.calculation.eligible ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 mb-4" : "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 mb-4"}>
                  <CheckCircle2 className={`h-4 w-4 ${searchResult.calculation.eligible ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`} />
                  <AlertDescription className={searchResult.calculation.eligible ? "text-green-900 dark:text-green-100" : "text-yellow-900 dark:text-yellow-100"}>
                    <div className="font-semibold mb-2">
                      {searchResult.calculation.eligible ? "Potentially Eligible" : "May Not Be Eligible"}
                    </div>
                    {searchResult.calculation.estimatedBenefit !== undefined && searchResult.calculation.estimatedBenefit > 0 && (
                      <div className="text-2xl font-bold mb-2">
                        ${(searchResult.calculation.estimatedBenefit / 100).toFixed(2)} / month
                      </div>
                    )}
                    <div className="text-sm">{searchResult.calculation.reason}</div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Main Answer */}
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="text-accent-foreground h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 id="results-heading" className="font-semibold text-foreground">Answer</h3>
                    <FeedbackButton
                      feedbackType="ai_response"
                      relatedEntityType="search_query"
                      pageUrl={window.location.href}
                    />
                  </div>
                  <div className="prose dark:prose-invert max-w-none text-foreground">
                    <p className="whitespace-pre-wrap">{searchResult.answer}</p>
                  </div>
                </div>
              </div>

              {/* Calculation Breakdown */}
              {searchResult.calculation?.breakdown && searchResult.calculation.breakdown.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Calculation Steps
                    </h4>
                    <ul className="space-y-1 text-sm">
                      {searchResult.calculation.breakdown.map((step: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Policy Citations from Rules Engine */}
              {searchResult.calculation?.policyCitations && searchResult.calculation.policyCitations.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Supporting Policy Sections
                    </h4>
                    <div className="grid gap-2">
                      {searchResult.calculation.policyCitations.map((citation, index) => (
                        <Card key={index} className="bg-muted/50 hover:bg-muted transition-colors">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    Section {citation.sectionNumber}
                                  </Badge>
                                  <span className="text-sm font-medium">{citation.sectionTitle}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{citation.description}</p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                asChild
                                className="flex-shrink-0"
                                data-testid={`button-view-section-${citation.sectionNumber}`}
                              >
                                <a href={`/policy-manual?section=${citation.sectionNumber}`}>
                                  View
                                </a>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Manual Citations from RAG */}
              {searchResult.aiExplanation?.citations && searchResult.aiExplanation.citations.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Relevant Manual Sections
                    </h4>
                    <div className="grid gap-2">
                      {searchResult.aiExplanation.citations.map((citation, index) => (
                        <Card key={index} className="bg-muted/50 hover:bg-muted transition-colors">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    Section {citation.sectionNumber}
                                  </Badge>
                                  <span className="text-sm font-medium">{citation.sectionTitle}</span>
                                  <Badge variant="secondary" className="text-xs ml-auto">
                                    {(citation.relevanceScore * 100).toFixed(0)}% relevant
                                  </Badge>
                                </div>
                                {citation.sourceUrl && (
                                  <a 
                                    href={citation.sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    View official document ↗
                                  </a>
                                )}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                asChild
                                className="flex-shrink-0"
                                data-testid={`button-view-manual-${citation.sectionNumber}`}
                              >
                                <a href={`/policy-manual?section=${citation.sectionNumber}`}>
                                  View
                                </a>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Next Steps */}
              {searchResult.nextSteps && searchResult.nextSteps.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Next Steps
                    </h4>
                    <ul className="space-y-2">
                      {searchResult.nextSteps.map((step, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* Sources (for AI explanations) */}
              {searchResult.aiExplanation?.sources && searchResult.aiExplanation.sources.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Policy References
                    </h4>
                    <div className="space-y-2">
                      {searchResult.aiExplanation.sources.slice(0, 3).map((source, index) => (
                        <Card key={index} className="bg-muted">
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-medium text-foreground">{source.filename}</span>
                              <Badge variant="outline" className="text-xs">
                                {(source.relevanceScore * 100).toFixed(0)}% match
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {source.content}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Classification Debug Info */}
              {searchResult.classification && (
                <div className="mt-4 pt-4 border-t border-border">
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Query Analysis</summary>
                    <div className="mt-2 space-y-1 pl-4">
                      <div>Type: <Badge variant="outline" className="text-xs ml-2">{searchResult.classification.type}</Badge></div>
                      <div>Confidence: {(searchResult.classification.confidence * 100).toFixed(0)}%</div>
                      <div>Reasoning: {searchResult.classification.reasoning}</div>
                    </div>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Rating - User feedback on search quality */}
          <div className="mt-4">
            <QuickRating
              ratingType="policy_search"
              relatedEntityType="search_query"
              relatedEntityId={executedQuery}
              containerClassName="flex justify-end"
            />
          </div>
        </section>
      )}
    </div>
  );
}
