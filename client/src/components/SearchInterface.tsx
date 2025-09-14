import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Bot } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  answer: string;
  sources: Array<{
    documentId: string;
    filename: string;
    content: string;
    relevanceScore: number;
    pageNumber?: number;
  }>;
  relevanceScore?: number;
  queryAnalysis?: {
    intent: string;
    entities: string[];
    benefitProgram?: string;
  };
}

export default function SearchInterface() {
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const { toast } = useToast();

  const { data: benefitPrograms = [] } = useQuery({
    queryKey: ["/api/benefit-programs"],
  });

  const searchMutation = useMutation({
    mutationFn: async ({ query }: { query: string }) => {
      const response = await apiRequest("POST", "/api/search", { query });
      return response.json();
    },
    onSuccess: (data: SearchResult) => {
      setSearchResult(data);
    },
    onError: (error) => {
      toast({
        title: "Search Failed",
        description: "Unable to process your search query. Please try again.",
        variant: "destructive",
      });
      console.error("Search error:", error);
    },
  });

  const handleSearch = (searchQuery?: string) => {
    const queryToSearch = searchQuery || query;
    if (!queryToSearch.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a search query.",
        variant: "destructive",
      });
      return;
    }
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
    "Maryland SNAP income limits 2025",
    "ABAWD work requirements", 
    "Student eligibility for SNAP",
    "Asset limits for SNAP benefits"
  ];

  return (
    <div className="space-y-8">
      {/* Search Interface */}
      <Card className="shadow-lg border border-border">
        <CardContent className="p-6">
          <div className="relative">
            <Input 
              type="text" 
              placeholder="Ask about Maryland SNAP policies: eligibility, benefits calculation, work requirements..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full p-4 pr-12 text-lg"
              data-testid="input-search"
            />
            <Button 
              onClick={() => handleSearch()}
              disabled={searchMutation.isPending}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
              data-testid="button-search"
            >
              {searchMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
          </div>
          
          {/* Quick Search Options */}
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">Popular searches:</p>
            <div className="flex flex-wrap gap-2">
              {quickSearches.map((search) => (
                <Button 
                  key={search}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSearch(search)}
                  disabled={searchMutation.isPending}
                  data-testid={`button-quick-search-${search.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {search}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResult && (
        <Card className="shadow-lg border border-border slide-up">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3 mb-4">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="text-accent-foreground h-4 w-4" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">AI Assistant Response</h3>
                
                {/* Query Analysis */}
                {searchResult.queryAnalysis && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      Intent: {searchResult.queryAnalysis.intent}
                    </Badge>
                    {searchResult.queryAnalysis.benefitProgram && (
                      <Badge variant="outline">
                        Program: {searchResult.queryAnalysis.benefitProgram}
                      </Badge>
                    )}
                    {searchResult.queryAnalysis.entities.length > 0 && (
                      searchResult.queryAnalysis.entities.slice(0, 3).map(entity => (
                        <Badge key={entity} variant="outline">
                          {entity}
                        </Badge>
                      ))
                    )}
                  </div>
                )}

                {/* AI Response */}
                <div className="prose prose-sm max-w-none text-muted-foreground mb-4">
                  <div className="whitespace-pre-wrap">{searchResult.answer}</div>
                </div>
                
                {/* Source Citations */}
                {searchResult.sources.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Sources:</p>
                    <div className="space-y-1">
                      {searchResult.sources.map((source, index) => (
                        <div 
                          key={source.documentId} 
                          className="text-xs text-muted-foreground"
                          data-testid={`source-${index}`}
                        >
                          📄 {source.filename}
                          {source.pageNumber && ` (Page ${source.pageNumber})`}
                          <span className="ml-2 text-green-600">
                            {Math.round(source.relevanceScore * 100)}% relevance
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {searchResult.relevanceScore && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Overall confidence: {Math.round(searchResult.relevanceScore * 100)}%
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
