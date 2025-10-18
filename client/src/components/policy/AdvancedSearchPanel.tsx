import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, X, FileText, Code, Calendar, Filter } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
  id: string;
  chapterId: string;
  sectionNumber: string;
  title: string;
  content: string;
  pageNumber?: number;
  pageNumberEnd?: number;
  legalCitation?: string;
  rulesAsCodeReference?: string;
  sourceUrl?: string;
  effectiveDate?: string;
  chapterTitle: string;
  chapterNumber: number;
  program: string;
}

interface FilterOptions {
  programs: string[];
  years: number[];
  racStats: {
    withRaC: number;
    withoutRaC: number;
  };
}

interface AdvancedSearchPanelProps {
  onSelectSection?: (sectionId: string) => void;
}

export default function AdvancedSearchPanel({ onSelectSection }: AdvancedSearchPanelProps) {
  const [searchMode, setSearchMode] = useState<'keyword' | 'citation' | 'semantic'>('keyword');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasRaC, setHasRaC] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Fetch filter options
  const { data: filters, isLoading: filtersLoading } = useQuery<FilterOptions>({
    queryKey: ['/api/policy-manual/filters'],
  });

  // Build search params
  const buildSearchParams = () => {
    const params = new URLSearchParams();
    params.set('q', debouncedQuery);
    params.set('mode', searchMode);
    
    if (selectedPrograms.length > 0) {
      params.set('programs', selectedPrograms.join(','));
    }
    
    if (dateFrom) {
      params.set('dateFrom', dateFrom);
    }
    
    if (dateTo) {
      params.set('dateTo', dateTo);
    }
    
    if (hasRaC) {
      params.set('hasRaC', 'true');
    }
    
    return params.toString();
  };

  // Search results query
  const { data: results, isLoading: searchLoading } = useQuery<SearchResult[]>({
    queryKey: ['/api/policy-manual/search', buildSearchParams()],
    enabled: searchActive && debouncedQuery.length >= 2,
  });

  // Auto-trigger search when query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setSearchActive(true);
    } else {
      setSearchActive(false);
    }
  }, [debouncedQuery]);

  const handleReset = () => {
    setSearchQuery('');
    setSearchMode('keyword');
    setSelectedPrograms([]);
    setDateFrom('');
    setDateTo('');
    setHasRaC(false);
    setSearchActive(false);
  };

  const handleProgramToggle = (program: string) => {
    setSelectedPrograms(prev =>
      prev.includes(program)
        ? prev.filter(p => p !== program)
        : [...prev, program]
    );
  };

  const highlightText = (text: string, query: string) => {
    if (!query || query.length < 2) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getContentPreview = (content: string) => {
    if (!content) return '';
    
    // Try to find content around search query
    if (debouncedQuery && content.toLowerCase().includes(debouncedQuery.toLowerCase())) {
      const index = content.toLowerCase().indexOf(debouncedQuery.toLowerCase());
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + 100);
      let preview = content.substring(start, end);
      
      if (start > 0) preview = '...' + preview;
      if (end < content.length) preview = preview + '...';
      
      return preview;
    }
    
    return content.substring(0, 150) + (content.length > 150 ? '...' : '');
  };

  return (
    <div className="flex flex-col h-full" data-testid="advanced-search-panel">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Advanced Policy Search
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col p-4">
        <div className="space-y-4 mb-4">
          {/* Search Mode Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Search Mode</Label>
            <RadioGroup
              value={searchMode}
              onValueChange={(value: any) => setSearchMode(value)}
              className="flex gap-4"
              data-testid="search-mode-group"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="keyword" id="mode-keyword" data-testid="mode-keyword" />
                <Label htmlFor="mode-keyword" className="cursor-pointer font-normal">
                  Keyword
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="citation" id="mode-citation" data-testid="mode-citation" />
                <Label htmlFor="mode-citation" className="cursor-pointer font-normal">
                  Citation
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="semantic" id="mode-semantic" data-testid="mode-semantic" />
                <Label htmlFor="mode-semantic" className="cursor-pointer font-normal">
                  Semantic
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-1">
              {searchMode === 'keyword' && 'Full-text search across titles, content, and keywords'}
              {searchMode === 'citation' && 'Search by legal citations (e.g., "7 CFR 273.9")'}
              {searchMode === 'semantic' && 'Smart search with synonym expansion'}
            </p>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={
                searchMode === 'citation'
                  ? 'Enter citation (e.g., 7 CFR 273)'
                  : 'Search policy manual...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
              data-testid="search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                data-testid="clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Separator />

          {/* Filters */}
          <div>
            <Label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Label>

            {/* Program Selection */}
            <div className="space-y-2 mb-3">
              <Label className="text-xs text-muted-foreground">Programs</Label>
              {filtersLoading ? (
                <div className="space-y-1">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filters?.programs.map((program) => (
                    <div key={program} className="flex items-center space-x-2">
                      <Checkbox
                        id={`program-${program}`}
                        checked={selectedPrograms.includes(program)}
                        onCheckedChange={() => handleProgramToggle(program)}
                        data-testid={`filter-program-${program}`}
                      />
                      <Label
                        htmlFor={`program-${program}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {program}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="space-y-2 mb-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Effective Date Range
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="date-from" className="text-xs">
                    From
                  </Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="text-sm"
                    data-testid="filter-date-from"
                  />
                </div>
                <div>
                  <Label htmlFor="date-to" className="text-xs">
                    To
                  </Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="text-sm"
                    data-testid="filter-date-to"
                  />
                </div>
              </div>
            </div>

            {/* RaC Filter */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has-rac"
                checked={hasRaC}
                onCheckedChange={(checked) => setHasRaC(checked as boolean)}
                data-testid="filter-has-rac"
              />
              <Label htmlFor="has-rac" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Code className="h-3 w-3" />
                Only show sections with Rules as Code
              </Label>
            </div>

            {filters && (
              <p className="text-xs text-muted-foreground mt-2">
                {filters.racStats.withRaC} sections have RaC implementation
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex-1"
              data-testid="button-reset-filters"
            >
              Reset
            </Button>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Results */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="mb-2">
            <Label className="text-sm font-medium">
              Results
              {results && ` (${results.length})`}
            </Label>
          </div>

          <ScrollArea className="flex-1">
            {!searchActive && (
              <div className="text-center py-8 text-muted-foreground" data-testid="search-placeholder">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Enter a search query to find policy sections</p>
              </div>
            )}

            {searchActive && searchLoading && (
              <div className="space-y-3" data-testid="search-loading">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-3">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {searchActive && !searchLoading && results && results.length === 0 && (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-results">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No results found</p>
                <p className="text-xs mt-1">Try adjusting your search query or filters</p>
              </div>
            )}

            {searchActive && !searchLoading && results && results.length > 0 && (
              <div className="space-y-3" data-testid="search-results">
                {results.map((result) => (
                  <Card
                    key={result.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => onSelectSection?.(result.id)}
                    data-testid={`result-${result.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1">
                            <FileText className="h-3 w-3 inline mr-1" />
                            {result.program}: {highlightText(result.title, debouncedQuery)}
                            {result.legalCitation && (
                              <span className="text-muted-foreground text-xs ml-2">
                                ({result.legalCitation})
                              </span>
                            )}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mb-2">
                            {result.pageNumber && (
                              <span>
                                Page {result.pageNumber}
                                {result.pageNumberEnd && result.pageNumberEnd !== result.pageNumber
                                  ? `-${result.pageNumberEnd}`
                                  : ''}
                              </span>
                            )}
                            <span>•</span>
                            <Badge variant="outline" className="text-xs">
                              {result.program}
                            </Badge>
                            {result.rulesAsCodeReference && (
                              <>
                                <span>•</span>
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  <Code className="h-3 w-3" />
                                  Has RaC
                                </Badge>
                              </>
                            )}
                            {result.effectiveDate && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(result.effectiveDate).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {highlightText(getContentPreview(result.content), debouncedQuery)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </div>
  );
}
