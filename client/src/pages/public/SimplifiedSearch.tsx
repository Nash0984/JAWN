import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Sparkles, List, ChevronDown, ChevronUp, MapPin, Filter } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import PublicPortalNav from "@/components/PublicPortalNav";
import { Helmet } from "react-helmet-async";
import { useTenant } from "@/contexts/TenantContext";

interface PublicFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  relatedQuestions: string[];
  viewCount: number;
  program?: string;
}

interface SearchResult {
  answer: string;
  sources: Array<{
    question: string;
    answer: string;
    relevance: number;
  }>;
  needsStateContext?: boolean;
}

interface StateOption {
  code: string;
  name: string;
  isActive?: boolean;
}

type ProgramFilter = "all" | "snap" | "medicaid" | "tanf" | "ohep" | "ssi" | "vita";

const BENEFIT_PROGRAMS = [
  { value: "snap", label: "SNAP (Food Assistance)" },
  { value: "medicaid", label: "Medicaid (Health Coverage)" },
  { value: "tanf", label: "TANF (Cash Assistance)" },
  { value: "ohep", label: "Energy Assistance" },
  { value: "ssi", label: "SSI (Disability)" },
];

const TAX_PROGRAMS = [
  { value: "vita", label: "VITA & Tax Credits" },
];

const BENEFITS_CATEGORIES = [
  { value: "all", label: "All Topics" },
  { value: "eligibility", label: "Eligibility Requirements" },
  { value: "income", label: "Income Rules" },
  { value: "resources", label: "Assets & Resources" },
  { value: "deductions", label: "Expenses & Deductions" },
  { value: "benefits", label: "Benefit Amounts" },
  { value: "application", label: "How to Apply" },
  { value: "using", label: "Using Your Benefits" },
  { value: "changes", label: "Reporting Changes" },
];

const TAX_CATEGORIES = [
  { value: "all", label: "All Topics" },
  { value: "filing", label: "Filing Assistance" },
  { value: "credits", label: "Tax Credits (EITC, CTC)" },
  { value: "documents", label: "Required Documents" },
  { value: "deadlines", label: "Important Deadlines" },
  { value: "state-credits", label: "State Tax Credits" },
  { value: "refunds", label: "Refunds & Direct Deposit" },
  { value: "vita-sites", label: "VITA Site Locations" },
];

const ALL_CATEGORIES = [
  { value: "all", label: "All Topics" },
  { value: "eligibility", label: "Eligibility Requirements" },
  { value: "income", label: "Income Rules" },
  { value: "resources", label: "Assets & Resources" },
  { value: "application", label: "How to Apply" },
  { value: "credits", label: "Tax Credits" },
  { value: "filing", label: "Tax Filing Help" },
];

export default function SimplifiedSearch() {
  const { stateConfig, stateCode: tenantStateCode } = useTenant();
  const defaultStateName = stateConfig?.stateName || '';
  const defaultStateCode = tenantStateCode || '';
  
  const { toast } = useToast();
  const [mode, setMode] = useState<"simple" | "smart">("simple");
  const [selectedState, setSelectedState] = useState<string>(defaultStateCode);
  const [selectedProgram, setSelectedProgram] = useState<ProgramFilter>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [showStatePrompt, setShowStatePrompt] = useState<boolean>(false);

  const { data: supportedStates = [] } = useQuery<StateOption[]>({
    queryKey: ["/api/states/selector"],
    staleTime: 1000 * 60 * 10,
  });

  const selectedStateName = useMemo(() => {
    if (!selectedState) return '';
    return supportedStates.find(s => s.code === selectedState)?.name || '';
  }, [selectedState, supportedStates]);

  const isTaxProgram = selectedProgram === "vita";
  const isBenefitsProgram = ["snap", "medicaid", "tanf", "ohep", "ssi"].includes(selectedProgram);

  const categories = useMemo(() => {
    if (isTaxProgram) return TAX_CATEGORIES;
    if (isBenefitsProgram) return BENEFITS_CATEGORIES;
    return ALL_CATEGORIES;
  }, [isTaxProgram, isBenefitsProgram]);

  const pageTitle = useMemo(() => {
    if (selectedStateName) {
      return `${selectedStateName} Benefits & Tax Credits Search`;
    }
    return "Benefits & Tax Credits Policy Search";
  }, [selectedStateName]);

  const pageDescription = useMemo(() => {
    if (isTaxProgram) {
      return selectedStateName 
        ? `Get answers about tax credits and free tax filing help in ${selectedStateName}`
        : "Get answers about tax credits, EITC, Child Tax Credit, and free VITA tax filing assistance";
    }
    if (isBenefitsProgram) {
      const programLabel = [...BENEFIT_PROGRAMS].find(p => p.value === selectedProgram)?.label || "benefits";
      return selectedStateName
        ? `Get answers about ${programLabel} in ${selectedStateName}`
        : `Get answers about ${programLabel} eligibility and how to apply`;
    }
    return selectedStateName
      ? `Get answers about public benefits and tax credits in ${selectedStateName}`
      : "Get answers about public benefit programs and tax credits in simple language";
  }, [isTaxProgram, isBenefitsProgram, selectedProgram, selectedStateName]);

  const placeholderText = useMemo(() => {
    if (isTaxProgram) {
      return "e.g., How do I qualify for the Earned Income Tax Credit?";
    }
    if (selectedProgram === "snap") {
      return "e.g., Can I get food assistance if I work part time?";
    }
    if (selectedProgram === "medicaid") {
      return "e.g., What are the income limits for Medicaid?";
    }
    return "e.g., What benefits am I eligible for?";
  }, [isTaxProgram, selectedProgram]);

  const faqQueryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedState) params.append('state', selectedState);
    if (selectedProgram !== 'all') params.append('program', selectedProgram);
    const queryString = params.toString();
    return queryString ? `/api/public/faq?${queryString}` : '/api/public/faq';
  }, [selectedState, selectedProgram]);

  const { data: faqs = [], isLoading: faqsLoading } = useQuery<PublicFaq[]>({
    queryKey: [faqQueryUrl],
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch("/api/public/search-faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query,
          state: selectedState,
          program: selectedProgram !== "all" ? selectedProgram : undefined,
        }),
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResult(data);
      if (data.needsStateContext && !selectedState) {
        setShowStatePrompt(true);
      }
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
        description: "Please type your question about benefits or tax credits",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedState) {
      setShowStatePrompt(true);
      toast({
        title: "Select your state",
        description: "Please select your state for the most accurate answers",
        variant: "default",
      });
      return;
    }
    
    setShowStatePrompt(false);
    searchMutation.mutate(searchQuery);
  };

  const handleStateSelect = (stateCode: string) => {
    setSelectedState(stateCode);
    setShowStatePrompt(false);
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleProgramChange = (program: ProgramFilter) => {
    setSelectedProgram(program);
    setSelectedCategory("all");
  };

  const filteredFaqs = faqs.filter(
    (faq) => selectedCategory === "all" || faq.category === selectedCategory
  );

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle} - Benefits Navigator</title>
        <meta name="description" content={pageDescription} />
      </Helmet>
      <PublicPortalNav />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <a href="#content" className="skip-link">
          Skip to content
        </a>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageDescription}</p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter Your Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Your State
                </label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger data-testid="select-state">
                    <SelectValue placeholder="Select your state" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedStates.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Program Type</label>
                <Select value={selectedProgram} onValueChange={(v) => handleProgramChange(v as ProgramFilter)}>
                  <SelectTrigger data-testid="select-program">
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Benefit Programs
                    </div>
                    {BENEFIT_PROGRAMS.map((program) => (
                      <SelectItem key={program.value} value={program.value}>
                        {program.label}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Tax Assistance
                    </div>
                    {TAX_PROGRAMS.map((program) => (
                      <SelectItem key={program.value} value={program.value}>
                        {program.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedState && selectedProgram !== "all" && (
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="secondary">
                  {selectedStateName}
                </Badge>
                <Badge variant="outline">
                  {[...BENEFIT_PROGRAMS, ...TAX_PROGRAMS].find(p => p.value === selectedProgram)?.label}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

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
                <CardDescription>
                  {isTaxProgram 
                    ? "Browse common questions about tax credits and filing assistance"
                    : isBenefitsProgram
                    ? "Browse common questions about this benefit program"
                    : "Browse common questions by category"
                  }
                </CardDescription>
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
              {!selectedState ? (
                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Select your state to get started</p>
                    <p className="text-sm mb-3">
                      Benefits vary by state. Choose your state above to see relevant questions and answers.
                    </p>
                    {supportedStates.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {supportedStates.map((state) => (
                          <Button
                            key={state.code}
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedState(state.code)}
                          >
                            {state.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ) : faqsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-5 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded w-1/4 mt-2"></div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : filteredFaqs.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No questions found for this selection. Try selecting a different topic or program.
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
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge variant="secondary">
                              {categories.find((c) => c.value === faq.category)?.label || faq.category}
                            </Badge>
                            {faq.program && (
                              <Badge variant="outline">
                                {[...BENEFIT_PROGRAMS, ...TAX_PROGRAMS].find(p => p.value === faq.program)?.label || faq.program}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {expandedFaq === faq.id ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
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
                  {isTaxProgram
                    ? "Ask anything about tax credits and free tax filing help in your own words"
                    : "Ask anything about benefits and eligibility in your own words"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {showStatePrompt && !selectedState && (
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                    <MapPin className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Which state are you asking about?</p>
                      <p className="text-sm mb-3">
                        Benefits and tax credits vary by state. Select your state for the most accurate answer.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {supportedStates.map((state) => (
                          <Button
                            key={state.code}
                            variant="outline"
                            size="sm"
                            onClick={() => handleStateSelect(state.code)}
                          >
                            {state.name}
                          </Button>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder={placeholderText}
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
    </>
  );
}
