import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  List,
  FileText,
  Home,
  Bookmark,
  Share2,
  Printer,
  ZoomIn,
  ZoomOut,
  Menu,
  X,
} from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

export type ProgramType = 'snap' | 'medicaid' | 'tanf' | 'ohep' | 'ssi' | 'tax-credits';

interface ProgramConfig {
  id: ProgramType;
  name: string;
  fullName: string;
  tenantNames: Record<string, string>;
  description: string;
  icon: string;
  color: string;
}

const PROGRAM_CONFIGS: Record<ProgramType, ProgramConfig> = {
  snap: {
    id: 'snap',
    name: 'SNAP Manual',
    fullName: 'Supplemental Nutrition Assistance Program Policy Manual',
    tenantNames: {
      'Maryland': 'Maryland SNAP Policy Manual',
      'Pennsylvania': 'PA SNAP Handbook',
      'Virginia': 'Virginia SNAP Policy Guide',
      'Utah': 'Utah SNAP Manual',
      'Indiana': 'Indiana SNAP Policy',
      'Michigan': 'Michigan SNAP Manual',
    },
    description: 'Complete policy guidance for the Supplemental Nutrition Assistance Program',
    icon: '🍎',
    color: 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700',
  },
  medicaid: {
    id: 'medicaid',
    name: 'Medical Assistance Guide',
    fullName: 'Medical Assistance Program Policy Manual',
    tenantNames: {
      'Maryland': 'Maryland Medical Assistance Manual',
      'Pennsylvania': 'PA Medical Assistance Handbook',
      'Virginia': 'Virginia Medicaid Policy Guide',
      'Utah': 'Utah Medicaid Manual',
      'Indiana': 'Indiana Medicaid Policy',
      'Michigan': 'Healthy Michigan Plan Manual',
    },
    description: 'Comprehensive healthcare coverage eligibility and policy guidance',
    icon: '🏥',
    color: 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700',
  },
  tanf: {
    id: 'tanf',
    name: 'TCA Handbook',
    fullName: 'Temporary Cash Assistance Program Handbook',
    tenantNames: {
      'Maryland': 'Maryland TCA Policy Manual',
      'Pennsylvania': 'PA TANF Cash Assistance Guide',
      'Virginia': 'Virginia TANF Policy Manual',
      'Utah': 'Utah Family Employment Program Manual',
      'Indiana': 'Indiana TANF Policy',
      'Michigan': 'Michigan Family Independence Program Manual',
    },
    description: 'Temporary cash assistance program policies and procedures',
    icon: '💵',
    color: 'bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700',
  },
  ohep: {
    id: 'ohep',
    name: 'OHEP Guide',
    fullName: 'Office of Home Energy Programs Policy Guide',
    tenantNames: {
      'Maryland': 'Maryland OHEP Policy Manual',
      'Pennsylvania': 'PA LIHEAP Handbook',
      'Virginia': 'Virginia Energy Assistance Guide',
      'Utah': 'Utah HEAT Manual',
      'Indiana': 'Indiana EAP Policy',
      'Michigan': 'Michigan LIHEAP Manual',
    },
    description: 'Energy assistance programs including MEAP, EUSP, and Arrearage Retirement',
    icon: '⚡',
    color: 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700',
  },
  ssi: {
    id: 'ssi',
    name: 'SSI Reference',
    fullName: 'Supplemental Security Income Reference Guide',
    tenantNames: {
      'Maryland': 'Maryland SSI Supplement Guide',
      'Pennsylvania': 'PA SSI State Supplement Manual',
      'Virginia': 'Virginia SSI Reference',
      'Utah': 'Utah SSI Guide',
      'Indiana': 'Indiana SSI Reference',
      'Michigan': 'Michigan SSI Supplement Manual',
    },
    description: 'Federal SSI program with state supplement information',
    icon: '🛡️',
    color: 'bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700',
  },
  'tax-credits': {
    id: 'tax-credits',
    name: 'Tax Credits Guide',
    fullName: 'Refundable Tax Credits Policy Guide',
    tenantNames: {
      'Maryland': 'Maryland EITC & Tax Credits Manual',
      'Pennsylvania': 'PA Tax Forgiveness Guide',
      'Virginia': 'Virginia Tax Credits Guide',
      'Utah': 'Utah EITC Reference',
      'Indiana': 'Indiana Tax Credits Guide',
      'Michigan': 'Michigan EITC Manual',
    },
    description: 'EITC, CTC, and state-specific refundable tax credits guidance',
    icon: '📊',
    color: 'bg-emerald-100 dark:bg-emerald-900 border-emerald-300 dark:border-emerald-700',
  },
};

interface Chapter {
  id: string;
  number: string;
  title: string;
  sections: Section[];
}

interface Section {
  id: string;
  number: string;
  title: string;
  content?: string;
}

interface ProgramManualEbookProps {
  program: ProgramType;
}

export function ProgramManualEbook({ program }: ProgramManualEbookProps) {
  const { stateConfig } = useTenant();
  const [tocOpen, setTocOpen] = useState(true);
  const [currentChapter, setCurrentChapter] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fontSize, setFontSize] = useState(16);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  const config = PROGRAM_CONFIGS[program];
  const stateName = stateConfig?.stateName || 'Maryland';
  const manualTitle = config.tenantNames[stateName] || config.name;

  const { data: chaptersData, isLoading } = useQuery<{ chapters: Chapter[] }>({
    queryKey: ['/api/manual/program', program, 'chapters'],
  });

  const chapters = chaptersData?.chapters || generatePlaceholderChapters(program);

  useEffect(() => {
    if (chapters.length > 0 && !currentChapter) {
      setCurrentChapter(chapters[0].id);
      if (chapters[0].sections.length > 0) {
        setCurrentSection(chapters[0].sections[0].id);
      }
    }
  }, [chapters, currentChapter]);

  const currentChapterData = chapters.find(c => c.id === currentChapter);
  const currentSectionData = currentChapterData?.sections.find(s => s.id === currentSection);

  const filteredChapters = searchQuery
    ? chapters.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.sections.some(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : chapters;

  const navigateToSection = (chapterId: string, sectionId: string) => {
    setCurrentChapter(chapterId);
    setCurrentSection(sectionId);
  };

  const navigatePrev = () => {
    if (!currentChapterData) return;
    const currentSectionIndex = currentChapterData.sections.findIndex(s => s.id === currentSection);
    if (currentSectionIndex > 0) {
      setCurrentSection(currentChapterData.sections[currentSectionIndex - 1].id);
    } else {
      const chapterIndex = chapters.findIndex(c => c.id === currentChapter);
      if (chapterIndex > 0) {
        const prevChapter = chapters[chapterIndex - 1];
        setCurrentChapter(prevChapter.id);
        setCurrentSection(prevChapter.sections[prevChapter.sections.length - 1]?.id || null);
      }
    }
  };

  const navigateNext = () => {
    if (!currentChapterData) return;
    const currentSectionIndex = currentChapterData.sections.findIndex(s => s.id === currentSection);
    if (currentSectionIndex < currentChapterData.sections.length - 1) {
      setCurrentSection(currentChapterData.sections[currentSectionIndex + 1].id);
    } else {
      const chapterIndex = chapters.findIndex(c => c.id === currentChapter);
      if (chapterIndex < chapters.length - 1) {
        const nextChapter = chapters[chapterIndex + 1];
        setCurrentChapter(nextChapter.id);
        setCurrentSection(nextChapter.sections[0]?.id || null);
      }
    }
  };

  const toggleBookmark = () => {
    if (!currentSection) return;
    setBookmarks(prev =>
      prev.includes(currentSection)
        ? prev.filter(b => b !== currentSection)
        : [...prev, currentSection]
    );
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className={cn("border-b p-4", config.color)}>
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{config.icon}</span>
            <div>
              <h1 className="text-xl font-bold">{manualTitle}</h1>
              <p className="text-sm text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setFontSize(f => Math.max(12, f - 2))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-8 text-center">{fontSize}</span>
            <Button variant="ghost" size="icon" onClick={() => setFontSize(f => Math.min(24, f + 2))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="icon" onClick={toggleBookmark}>
              <Bookmark className={cn("h-4 w-4", currentSection && bookmarks.includes(currentSection) && "fill-current")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setTocOpen(!tocOpen)}>
              {tocOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {tocOpen && (
          <div className="w-80 border-r bg-muted/30 flex flex-col">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search chapters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))
                ) : (
                  filteredChapters.map((chapter) => (
                    <div key={chapter.id} className="space-y-1">
                      <button
                        onClick={() => {
                          setCurrentChapter(chapter.id);
                          if (chapter.sections.length > 0) {
                            setCurrentSection(chapter.sections[0].id);
                          }
                        }}
                        className={cn(
                          "w-full text-left p-2 rounded-md hover:bg-muted transition-colors",
                          currentChapter === chapter.id && "bg-primary/10 font-medium"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {chapter.number}
                          </Badge>
                          <span className="text-sm font-medium truncate">{chapter.title}</span>
                        </div>
                      </button>
                      {currentChapter === chapter.id && (
                        <div className="ml-4 space-y-1 border-l pl-3">
                          {chapter.sections.map((section) => (
                            <button
                              key={section.id}
                              onClick={() => navigateToSection(chapter.id, section.id)}
                              className={cn(
                                "w-full text-left p-1.5 rounded text-sm hover:bg-muted transition-colors flex items-center gap-2",
                                currentSection === section.id && "bg-muted font-medium"
                              )}
                            >
                              <span className="text-xs text-muted-foreground font-mono">{section.number}</span>
                              <span className="truncate">{section.title}</span>
                              {bookmarks.includes(section.id) && (
                                <Bookmark className="h-3 w-3 fill-current ml-auto flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto p-8" style={{ fontSize: `${fontSize}px` }}>
              {currentSectionData ? (
                <article className="prose dark:prose-invert max-w-none">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Badge variant="outline">{currentChapterData?.number}</Badge>
                    <ChevronRight className="h-4 w-4" />
                    <Badge variant="secondary">{currentSectionData.number}</Badge>
                  </div>
                  <h2 className="text-2xl font-bold mb-6">
                    {currentSectionData.number} {currentSectionData.title}
                  </h2>
                  <div className="leading-relaxed">
                    {currentSectionData.content || (
                      <p className="text-muted-foreground italic">
                        Content for this section is being loaded from the {stateName} policy database.
                        Check back soon or contact your administrator for assistance.
                      </p>
                    )}
                  </div>
                </article>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Select a section to begin reading</h3>
                  <p className="text-muted-foreground">
                    Use the table of contents to navigate the manual
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4 bg-muted/30">
            <div className="container mx-auto flex items-center justify-between">
              <Button variant="outline" onClick={navigatePrev} disabled={!currentChapter}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                {currentChapterData && (
                  <span>
                    Chapter {currentChapterData.number}: {currentChapterData.title}
                  </span>
                )}
              </div>
              <Button variant="outline" onClick={navigateNext} disabled={!currentChapter}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function generatePlaceholderChapters(program: ProgramType): Chapter[] {
  const programChapters: Record<ProgramType, { number: string; title: string; sections: { number: string; title: string }[] }[]> = {
    snap: [
      { number: '100', title: 'Introduction and General Provisions', sections: [
        { number: '100.1', title: 'Purpose and Scope' },
        { number: '100.2', title: 'Definitions' },
        { number: '100.3', title: 'Civil Rights Requirements' },
      ]},
      { number: '200', title: 'Application Processing', sections: [
        { number: '200.1', title: 'Right to Apply' },
        { number: '200.2', title: 'Application Form Requirements' },
        { number: '200.3', title: 'Interview Requirements' },
        { number: '200.4', title: 'Verification Requirements' },
      ]},
      { number: '300', title: 'Household Composition', sections: [
        { number: '300.1', title: 'Definition of Household' },
        { number: '300.2', title: 'Separate Household Status' },
        { number: '300.3', title: 'Ineligible Household Members' },
      ]},
      { number: '400', title: 'Income and Deductions', sections: [
        { number: '400.1', title: 'Gross Income Standards' },
        { number: '400.2', title: 'Net Income Calculation' },
        { number: '400.3', title: 'Standard Deduction' },
        { number: '400.4', title: 'Earned Income Deduction' },
        { number: '400.5', title: 'Shelter Deduction' },
        { number: '400.6', title: 'Medical Deduction' },
      ]},
      { number: '500', title: 'Resources', sections: [
        { number: '500.1', title: 'Resource Limits' },
        { number: '500.2', title: 'Countable Resources' },
        { number: '500.3', title: 'Excluded Resources' },
      ]},
      { number: '600', title: 'Work Requirements', sections: [
        { number: '600.1', title: 'General Work Requirements' },
        { number: '600.2', title: 'ABAWD Requirements' },
        { number: '600.3', title: 'Exemptions' },
        { number: '600.4', title: 'Sanctions' },
      ]},
      { number: '700', title: 'Benefit Determination', sections: [
        { number: '700.1', title: 'Allotment Calculation' },
        { number: '700.2', title: 'Minimum Benefit' },
        { number: '700.3', title: 'Proration' },
      ]},
    ],
    medicaid: [
      { number: '100', title: 'Introduction', sections: [
        { number: '100.1', title: 'Program Overview' },
        { number: '100.2', title: 'Covered Services' },
      ]},
      { number: '200', title: 'Eligibility Groups', sections: [
        { number: '200.1', title: 'Children and Families' },
        { number: '200.2', title: 'Pregnant Women' },
        { number: '200.3', title: 'Aged, Blind, and Disabled' },
        { number: '200.4', title: 'MAGI-Based Eligibility' },
      ]},
      { number: '300', title: 'Income Methodology', sections: [
        { number: '300.1', title: 'MAGI Income Counting' },
        { number: '300.2', title: 'Non-MAGI Income Counting' },
        { number: '300.3', title: 'Income Disregards' },
      ]},
      { number: '400', title: 'Application and Renewal', sections: [
        { number: '400.1', title: 'Application Process' },
        { number: '400.2', title: 'Renewal Process' },
        { number: '400.3', title: 'Verification' },
      ]},
    ],
    tanf: [
      { number: '100', title: 'Program Overview', sections: [
        { number: '100.1', title: 'Purpose and Goals' },
        { number: '100.2', title: 'Time Limits' },
      ]},
      { number: '200', title: 'Eligibility', sections: [
        { number: '200.1', title: 'Family Composition' },
        { number: '200.2', title: 'Income Limits' },
        { number: '200.3', title: 'Resource Limits' },
      ]},
      { number: '300', title: 'Work Requirements', sections: [
        { number: '300.1', title: 'Participation Requirements' },
        { number: '300.2', title: 'Countable Activities' },
        { number: '300.3', title: 'Good Cause Exemptions' },
        { number: '300.4', title: 'Sanctions' },
      ]},
      { number: '400', title: 'Benefits', sections: [
        { number: '400.1', title: 'Benefit Calculation' },
        { number: '400.2', title: 'Payment Methods' },
      ]},
    ],
    ohep: [
      { number: '100', title: 'Program Introduction', sections: [
        { number: '100.1', title: 'MEAP Overview' },
        { number: '100.2', title: 'EUSP Overview' },
        { number: '100.3', title: 'Arrearage Retirement' },
      ]},
      { number: '200', title: 'Eligibility', sections: [
        { number: '200.1', title: 'Income Guidelines' },
        { number: '200.2', title: 'Household Requirements' },
        { number: '200.3', title: 'Utility Account Requirements' },
      ]},
      { number: '300', title: 'Benefits', sections: [
        { number: '300.1', title: 'Benefit Amounts' },
        { number: '300.2', title: 'Crisis Benefits' },
        { number: '300.3', title: 'Fuel Assistance' },
      ]},
    ],
    ssi: [
      { number: '100', title: 'Program Overview', sections: [
        { number: '100.1', title: 'Federal SSI Program' },
        { number: '100.2', title: 'State Supplement' },
      ]},
      { number: '200', title: 'Eligibility', sections: [
        { number: '200.1', title: 'Age Requirements' },
        { number: '200.2', title: 'Disability Determination' },
        { number: '200.3', title: 'Income Limits' },
        { number: '200.4', title: 'Resource Limits' },
      ]},
      { number: '300', title: 'Benefits', sections: [
        { number: '300.1', title: 'Federal Benefit Rate' },
        { number: '300.2', title: 'State Supplement Amount' },
        { number: '300.3', title: 'Living Arrangement Impact' },
      ]},
    ],
    'tax-credits': [
      { number: '100', title: 'Earned Income Tax Credit', sections: [
        { number: '100.1', title: 'Federal EITC Overview' },
        { number: '100.2', title: 'State EITC Supplement' },
        { number: '100.3', title: 'Qualifying Child Rules' },
        { number: '100.4', title: 'Income Limits' },
      ]},
      { number: '200', title: 'Child Tax Credit', sections: [
        { number: '200.1', title: 'Federal CTC' },
        { number: '200.2', title: 'Additional Child Tax Credit' },
        { number: '200.3', title: 'Qualifying Child Requirements' },
      ]},
      { number: '300', title: 'State-Specific Credits', sections: [
        { number: '300.1', title: 'Poverty Level Credit' },
        { number: '300.2', title: 'Refundable Credits' },
        { number: '300.3', title: 'Local Credits' },
      ]},
      { number: '400', title: 'VITA Integration', sections: [
        { number: '400.1', title: 'Free Tax Preparation' },
        { number: '400.2', title: 'Benefits Crosswalk' },
        { number: '400.3', title: 'Cross-Enrollment Opportunities' },
      ]},
    ],
  };

  return programChapters[program].map(chapter => ({
    id: `${program}-${chapter.number}`,
    number: chapter.number,
    title: chapter.title,
    sections: chapter.sections.map(section => ({
      id: `${program}-${section.number}`,
      number: section.number,
      title: section.title,
    })),
  }));
}
