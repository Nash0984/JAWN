import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Sparkles, List, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface PublicFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  relatedQuestions: string[];
  viewCount: number;
}

interface SearchResult {
  answer: string;
  sources: Array<{
    question: string;
    answer: string;
    relevance: number;
  }>;
}

export default function SimplifiedSearch() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"simple" | "smart">("simple");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const { data: faqs = [] } = useQuery<PublicFaq[]>({
    queryKey: ["/api/public/faq"],
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/public/search-faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResult(data);
    },
    onError: () => {
      toast({
        title: "Search failed",
        description: "Could not search right now. Try browsing by category instead.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Enter a question",
        description: "Please type your question about SNAP benefits",
        variant: "destructive",
      });
      return;
    }
    searchMutation.mutate(searchQuery);
  };

  const categories = [
    { value: "all", label: "All Topics" },
    { value: "eligibility", label: "Who Can Get SNAP" },
    { value: "income", label: "Income Rules" },
    { value: "resources", label: "What You Own" },
    { value: "deductions", label: "Expenses & Deductions" },
    { value: "benefits", label: "Benefit Amounts" },
    { value: "application", label: "How to Apply" },
    { value: "using", label: "Using Your Benefits" },
    { value: "changes", label: "Reporting Changes" },
  ];

  const filteredFaqs = faqs.filter(
    (faq) => selectedCategory === "all" || faq.category === selectedCategory
  );

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <a href="#content" className="skip-link">
        Skip to content
      </a>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">SNAP Policy Search</h1>
        <p className="text-muted-foreground">
          Get answers about SNAP benefits in simple language
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "smart")} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="simple" data-testid="tab-simple-mode">
            <List className="h-4 w-4 mr-2" />
            Browse Topics
          </TabsTrigger>
          <TabsTrigger value="smart" data-testid="tab-smart-mode">
            <Sparkles className="h-4 w-4 mr-2" />
            Ask a Question
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Choose a Topic</CardTitle>
              <CardDescription>Browse common questions by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat.value}
                    variant={selectedCategory === cat.value ? "default" : "outline"}
                    onClick={() => setSelectedCategory(cat.value)}
                    className="justify-start"
                    data-testid={`button-category-${cat.value}`}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div id="content" className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No questions found in this category
                </AlertDescription>
              </Alert>
            ) : (
              filteredFaqs.map((faq) => (
                <Card key={faq.id}>
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full text-left"
                    aria-expanded={expandedFaq === faq.id}
                    data-testid={`button-faq-${faq.id}`}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{faq.question}</CardTitle>
                        <Badge variant="secondary" className="mt-2">
                          {categories.find((c) => c.value === faq.category)?.label || faq.category}
                        </Badge>
                      </div>
                      {expandedFaq === faq.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </CardHeader>
                  </button>
                  {expandedFaq === faq.id && (
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">{faq.answer}</p>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="smart" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Ask Your Question
              </CardTitle>
              <CardDescription>
                Ask anything about SNAP benefits in your own words
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="e.g., Can I get SNAP if I work part time?"
                  data-testid="input-search-query"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searchMutation.isPending}
                  data-testid="button-search"
                >
                  {searchMutation.isPending ? "Searching..." : "Search"}
                </Button>
              </div>

              {searchResult && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Answer:</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {searchResult.answer}
                    </p>
                  </div>

                  {searchResult.sources && searchResult.sources.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Related Information:</h4>
                      <div className="space-y-2">
                        {searchResult.sources.map((source, idx) => (
                          <Card key={idx} className="bg-accent/50">
                            <CardHeader>
                              <CardTitle className="text-sm">{source.question}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground">{source.answer}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
