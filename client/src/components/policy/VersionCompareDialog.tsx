import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, X, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface VersionCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  sectionTitle: string;
  oldVersionId: string;
  oldVersionNumber: number;
  oldVersionDate: string;
  newVersionNumber: number;
  newVersionDate: string;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'deleted' | 'modified';
  content: string;
  lineNumber: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffResponse {
  versionId: string;
  sectionId: string;
  oldContent: string;
  newContent: string;
  diffLines: DiffLine[];
  metadata: {
    versionNumber: number;
    changeSummary: string;
    effectiveDate: string;
    changeType: string;
  };
}

export default function VersionCompareDialog({
  open,
  onOpenChange,
  sectionId,
  sectionTitle,
  oldVersionId,
  oldVersionNumber,
  oldVersionDate,
  newVersionNumber,
  newVersionDate,
}: VersionCompareDialogProps) {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const [syncScroll, setSyncScroll] = useState(true);

  const { data: diffData, isLoading } = useQuery<DiffResponse>({
    queryKey: ['/api/policy-manual/versions', oldVersionId, 'diff'],
    enabled: open,
  });

  // Synchronized scrolling
  const handleLeftScroll = () => {
    if (syncScroll && leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
  };

  const handleRightScroll = () => {
    if (syncScroll && leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
  };

  const handleExportDiff = () => {
    // TODO: Implement PDF export
    console.log('Export diff as PDF');
  };

  const getLineStyle = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 dark:bg-green-950/30 border-l-4 border-green-500';
      case 'deleted':
        return 'bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500';
      case 'modified':
        return 'bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-500';
      default:
        return 'bg-background';
    }
  };

  const renderSplitView = () => {
    if (!diffData) return null;

    const oldLines = diffData.oldContent.split('\n');
    const newLines = diffData.newContent.split('\n');

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-border">
        {/* Left side - Old version */}
        <div className="bg-background">
          <div className="sticky top-0 z-10 bg-muted border-b px-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Version {oldVersionNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(oldVersionDate), 'MMM d, yyyy')}
                </p>
              </div>
              <Badge variant="outline">Old</Badge>
            </div>
          </div>
          <ScrollArea
            className="h-[60vh]"
            ref={leftScrollRef}
            onScrollCapture={handleLeftScroll}
          >
            <div className="font-mono text-xs">
              {diffData.diffLines.map((line, index) => {
                if (line.type === 'added') return null;
                return (
                  <div
                    key={index}
                    className={cn(
                      'px-4 py-1 min-h-[24px]',
                      getLineStyle(line.type)
                    )}
                    data-testid={`diff-line-old-${index}`}
                  >
                    <span className="text-muted-foreground mr-4 select-none inline-block w-8">
                      {line.oldLineNumber || ''}
                    </span>
                    <span className="whitespace-pre-wrap break-words">
                      {line.type === 'deleted' && (
                        <span className="text-red-600 dark:text-red-400 mr-1">-</span>
                      )}
                      {line.content || ' '}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right side - New version */}
        <div className="bg-background">
          <div className="sticky top-0 z-10 bg-muted border-b px-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Version {newVersionNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(newVersionDate), 'MMM d, yyyy')}
                </p>
              </div>
              <Badge variant="default">Current</Badge>
            </div>
          </div>
          <ScrollArea
            className="h-[60vh]"
            ref={rightScrollRef}
            onScrollCapture={handleRightScroll}
          >
            <div className="font-mono text-xs">
              {diffData.diffLines.map((line, index) => {
                if (line.type === 'deleted') return null;
                return (
                  <div
                    key={index}
                    className={cn(
                      'px-4 py-1 min-h-[24px]',
                      getLineStyle(line.type)
                    )}
                    data-testid={`diff-line-new-${index}`}
                  >
                    <span className="text-muted-foreground mr-4 select-none inline-block w-8">
                      {line.newLineNumber || ''}
                    </span>
                    <span className="whitespace-pre-wrap break-words">
                      {line.type === 'added' && (
                        <span className="text-green-600 dark:text-green-400 mr-1">+</span>
                      )}
                      {line.content || ' '}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">
                Compare Versions
              </DialogTitle>
              <DialogDescription>
                {sectionTitle}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline">
                  v{oldVersionNumber} → v{newVersionNumber}
                </Badge>
                {diffData?.metadata && (
                  <span className="text-xs text-muted-foreground">
                    {diffData.metadata.changeSummary}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDiff}
                data-testid="button-export-diff"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSyncScroll(!syncScroll)}
                data-testid="button-toggle-sync"
              >
                <ArrowLeftRight className={cn(
                  "h-4 w-4",
                  syncScroll && "text-primary"
                )} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            renderSplitView()
          )}
        </div>

        {diffData && (
          <div className="border-t px-6 py-4 bg-muted/50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-500 rounded" />
                  <span className="text-muted-foreground">
                    Added: {diffData.diffLines.filter(l => l.type === 'added').length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-red-500 rounded" />
                  <span className="text-muted-foreground">
                    Deleted: {diffData.diffLines.filter(l => l.type === 'deleted').length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-yellow-500 rounded" />
                  <span className="text-muted-foreground">
                    Modified: {diffData.diffLines.filter(l => l.type === 'modified').length}
                  </span>
                </div>
              </div>
              <span className="text-muted-foreground text-xs">
                Scroll synchronization: {syncScroll ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
