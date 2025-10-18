import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Search, 
  Printer, 
  Download, 
  Bookmark, 
  ZoomIn, 
  ZoomOut,
  ChevronRight,
  ChevronDown,
  Menu,
  ExternalLink,
  Code,
  FileText,
  BookOpen
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Helmet } from "react-helmet-async";

interface Chapter {
  id: string;
  chapterNumber: number;
  title: string;
  program: string;
  description: string;
  sortOrder: number;
  sectionCount: number;
}

interface Section {
  id: string;
  chapterId: string;
  sectionNumber: string;
  title: string;
  content?: string;
  pageNumber?: number;
  pageNumberEnd?: number;
  legalCitation?: string;
  rulesAsCodeReference?: string;
  sourceUrl?: string;
  keywords?: string;
  crossReferences?: any;
  sortOrder: number;
  chapterTitle?: string;
  chapterNumber?: number;
  program?: string;
  sourceId?: string;
  sourceName?: string;
}

interface SearchResult {
  id: string;
  chapterId: string;
  sectionNumber: string;
  title: string;
  content: string;
  pageNumber?: number;
  pageNumberEnd?: number;
  legalCitation?: string;
  chapterTitle: string;
  chapterNumber: number;
  program: string;
}

export default function PolicyManualBrowser() {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: chapters, isLoading: chaptersLoading } = useQuery<Chapter[]>({
    queryKey: ['/api/policy-manual/chapters'],
  });

  const { data: selectedSection, isLoading: sectionLoading } = useQuery<Section>({
    queryKey: ['/api/policy-manual/sections', selectedSectionId],
    enabled: !!selectedSectionId,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<SearchResult[]>({
    queryKey: ['/api/policy-manual/search', searchQuery],
    enabled: searchActive && searchQuery.length >= 2,
  });

  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterId)) {
      newExpanded.delete(chapterId);
    } else {
      newExpanded.add(chapterId);
    }
    setExpandedChapters(newExpanded);
  };

  const handleSearch = () => {
    if (searchQuery.length >= 2) {
      setSearchActive(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    alert("PDF export feature coming soon!");
  };

  const ChapterNavItem = ({ chapter }: { chapter: Chapter }) => {
    const [sections, setSections] = useState<Section[]>([]);
    const [sectionsLoaded, setSectionsLoaded] = useState(false);
    const isExpanded = expandedChapters.has(chapter.id);

    const loadSections = async () => {
      if (!sectionsLoaded && isExpanded) {
        const response = await fetch(`/api/policy-manual/chapters/${chapter.id}/sections`);
        const data = await response.json();
        setSections(data);
        setSectionsLoaded(true);
      }
    };

    if (isExpanded && !sectionsLoaded) {
      loadSections();
    }

    return (
      <div className="mb-1">
        <button
          onClick={() => toggleChapter(chapter.id)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent text-sm font-medium transition-colors"
          data-testid={`chapter-${chapter.chapterNumber}`}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span>Ch {chapter.chapterNumber}: {chapter.title}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {chapter.sectionCount}
          </Badge>
        </button>
        
        {isExpanded && (
          <div className="ml-6 mt-1 space-y-0.5">
            {sectionsLoaded ? (
              sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setSelectedSectionId(section.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedSectionId === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                  data-testid={`section-${section.sectionNumber}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{section.sectionNumber} {section.title}</span>
                    {section.pageNumber && (
                      <span className="text-xs opacity-70">
                        p. {section.pageNumber}
                        {section.pageNumberEnd && section.pageNumberEnd !== section.pageNumber 
                          ? `-${section.pageNumberEnd}` 
                          : ''}
                      </span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2">
                <Skeleton className="h-6 w-full mb-1" />
                <Skeleton className="h-6 w-full mb-1" />
                <Skeleton className="h-6 w-full" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const NavigationSidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Policy Manual
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Maryland Benefits & Tax Programs
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1">
          {chaptersLoading ? (
            <>
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full mb-2" />
            </>
          ) : (
            chapters?.map((chapter) => (
              <ChapterNavItem key={chapter.id} chapter={chapter} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const QuickReferenceSidebar = () => {
    if (!selectedSection) return null;

    const crossRefs = selectedSection.crossReferences as any[] || [];

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Quick Reference</h3>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {selectedSection.legalCitation && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                  Legal Citation
                </h4>
                <p className="text-sm">{selectedSection.legalCitation}</p>
              </div>
            )}

            {selectedSection.keywords && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                  Keywords
                </h4>
                <div className="flex flex-wrap gap-1">
                  {selectedSection.keywords.split(',').map((keyword, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {keyword.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {crossRefs.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                  Related Sections
                </h4>
                <div className="space-y-1">
                  {crossRefs.map((ref: any, idx) => (
                    <button
                      key={idx}
                      className="text-sm text-primary hover:underline block text-left"
                      onClick={() => setSelectedSectionId(ref.id)}
                    >
                      • {ref.sectionNumber} {ref.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSection.pageNumber && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                  Page Reference
                </h4>
                <p className="text-sm">
                  Pages {selectedSection.pageNumber}
                  {selectedSection.pageNumberEnd && selectedSection.pageNumberEnd !== selectedSection.pageNumber 
                    ? `-${selectedSection.pageNumberEnd}` 
                    : ''}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Policy Manual Browser - Maryland Benefits Navigator</title>
        <meta 
          name="description" 
          content="Browse Maryland's comprehensive benefits and tax policy manual with searchable chapters and sections." 
        />
      </Helmet>

      <div className="flex flex-col h-screen">
        {/* Top Toolbar */}
        <div className="border-b bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4 flex-1 max-w-2xl">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="lg:hidden" data-testid="button-mobile-nav">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0">
                  <NavigationSidebar mobile />
                </SheetContent>
              </Sheet>

              <h1 className="text-lg font-semibold hidden sm:block">
                Maryland Benefits-Tax Policy Manual
              </h1>
              
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search manual..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-8"
                    data-testid="input-search"
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSearch}
                disabled={searchQuery.length < 2}
                data-testid="button-search"
              >
                Search
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-8 text-center">
                {fontSize}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <Button variant="ghost" size="sm" onClick={handlePrint} data-testid="button-print">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportPDF} data-testid="button-export">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-bookmark">
                <Bookmark className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Navigation (Desktop) */}
          <div className="hidden lg:block w-80 border-r bg-muted/30">
            <NavigationSidebar />
          </div>

          {/* Center - Section Content */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="max-w-4xl mx-auto p-6 lg:p-8">
                {searchActive && searchResults ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Search Results for "{searchQuery}"
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {searchLoading ? (
                        <>
                          <Skeleton className="h-20 w-full mb-3" />
                          <Skeleton className="h-20 w-full mb-3" />
                          <Skeleton className="h-20 w-full" />
                        </>
                      ) : searchResults.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          No results found for "{searchQuery}"
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {searchResults.map((result) => (
                            <button
                              key={result.id}
                              onClick={() => {
                                setSelectedSectionId(result.id);
                                setSearchActive(false);
                              }}
                              className="w-full text-left p-4 rounded-lg border hover:bg-accent transition-colors"
                              data-testid={`search-result-${result.id}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <Badge variant="outline" className="mb-1">
                                    {result.program}
                                  </Badge>
                                  <h3 className="font-semibold">
                                    {result.sectionNumber} {result.title}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {result.chapterTitle}
                                  </p>
                                </div>
                                {result.pageNumber && (
                                  <span className="text-sm text-muted-foreground">
                                    p. {result.pageNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm line-clamp-2">
                                {result.content.substring(0, 200)}...
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : selectedSection ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{selectedSection.program}</Badge>
                            {selectedSection.pageNumber && (
                              <span className="text-sm text-muted-foreground">
                                Pages {selectedSection.pageNumber}
                                {selectedSection.pageNumberEnd && selectedSection.pageNumberEnd !== selectedSection.pageNumber 
                                  ? `-${selectedSection.pageNumberEnd}` 
                                  : ''}
                              </span>
                            )}
                          </div>
                          <CardTitle className="text-2xl">
                            {selectedSection.sectionNumber} {selectedSection.title}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {selectedSection.chapterTitle}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {sectionLoading ? (
                        <>
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-3/4 mb-4" />
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-2/3" />
                        </>
                      ) : (
                        <div style={{ fontSize: `${fontSize}px` }} className="prose dark:prose-invert max-w-none">
                          <ReactMarkdown>{selectedSection.content || ''}</ReactMarkdown>
                        </div>
                      )}

                      {selectedSection && !sectionLoading && (
                        <div className="mt-8 pt-6 border-t space-y-4">
                          {selectedSection.legalCitation && (
                            <div className="flex items-start gap-2">
                              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold">Legal Citation</p>
                                <p className="text-sm text-muted-foreground">
                                  {selectedSection.legalCitation}
                                </p>
                              </div>
                            </div>
                          )}

                          {selectedSection.sourceUrl && (
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                data-testid="button-view-source"
                              >
                                <a 
                                  href={selectedSection.sourceUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  View Original Source
                                </a>
                              </Button>
                            </div>
                          )}

                          {selectedSection.rulesAsCodeReference && (
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                data-testid="button-view-rac"
                              >
                                <a 
                                  href={selectedSection.rulesAsCodeReference} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2"
                                >
                                  <Code className="h-4 w-4" />
                                  View in Rules as Code
                                </a>
                              </Button>
                            </div>
                          )}

                          {selectedSection.sourceName && (
                            <p className="text-xs text-muted-foreground">
                              Source: {selectedSection.sourceName}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
                      <h2 className="text-xl font-semibold mb-2">
                        Welcome to the Policy Manual
                      </h2>
                      <p className="text-muted-foreground text-center max-w-md">
                        Select a chapter and section from the navigation to begin browsing, 
                        or use the search bar to find specific policy information.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Sidebar - Quick Reference (Desktop) */}
          {selectedSection && (
            <div className="hidden xl:block w-64 border-l bg-muted/30">
              <QuickReferenceSidebar />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
