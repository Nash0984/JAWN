import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, User, Eye, GitCompare, Clock, Code } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TemplateVersionHistoryProps {
  templateId: string;
  templateName: string;
}

interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: string;
  changesSummary: string;
  effectiveDate: string;
  createdAt: string;
  updatedByUser: {
    id: string;
    username: string;
    fullName: string | null;
  } | null;
}

interface CompareData {
  templateId: string;
  v1: {
    id: string;
    versionNumber: string;
    content: string;
    rules: any;
    effectiveDate: string;
  };
  v2: {
    id: string;
    versionNumber: string;
    content: string;
    rules: any;
    effectiveDate: string;
  };
  diff: {
    content: Array<{
      type: 'unchanged' | 'added' | 'deleted' | 'modified';
      content: string;
      lineNumber: number;
    }>;
    rules: {
      added: string[];
      removed: string[];
      modified: Array<{ key: string; oldValue: any; newValue: any }>;
      hasChanges: boolean;
    };
  };
}

export default function TemplateVersionHistory({
  templateId,
  templateName,
}: TemplateVersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const { data: versions, isLoading } = useQuery<TemplateVersion[]>({
    queryKey: ['/api/notifications/templates', templateId, 'versions'],
  });

  const { data: compareData, isLoading: compareLoading } = useQuery<CompareData>({
    queryKey: [
      '/api/notifications/templates',
      templateId,
      'compare',
      { version1: selectedVersion?.id, version2: versions?.[0]?.id },
    ],
    enabled: !!selectedVersion && !!versions?.[0],
  });

  const handleCompare = (version: TemplateVersion) => {
    setSelectedVersion(version);
    setCompareDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Version History</h3>
          <p className="text-sm text-muted-foreground">
            This template doesn't have any version history yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-xl font-semibold mb-1">Template Version History</h2>
          <p className="text-sm text-muted-foreground">{templateName}</p>
          <Badge variant="outline" className="mt-2">
            {versions.length} {versions.length === 1 ? 'version' : 'versions'}
          </Badge>
        </div>

        <ScrollArea className="h-[600px]">
          <div className="space-y-4">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={cn(
                  "bg-card border rounded-lg p-4 space-y-3",
                  index === 0 && "border-primary"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">
                        Version {version.versionNumber}
                      </h3>
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {version.changesSummary}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(version.effectiveDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {version.updatedByUser && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>
                            {version.updatedByUser.fullName || version.updatedByUser.username}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {index > 0 && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCompare(version)}
                      data-testid={`button-compare-template-version-${version.versionNumber}`}
                    >
                      <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                      Compare to Current
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Template Comparison</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {templateName} - v{selectedVersion?.versionNumber} vs v{versions[0]?.versionNumber}
            </p>
          </DialogHeader>

          {compareLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : compareData ? (
            <div className="space-y-6 p-6">
              {/* Content Changes */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Template Content Changes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-muted p-4 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Version {compareData.v1.versionNumber}
                    </p>
                    <pre className="text-xs whitespace-pre-wrap bg-background p-3 rounded border">
                      {compareData.v1.content}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Version {compareData.v2.versionNumber} (Current)
                    </p>
                    <pre className="text-xs whitespace-pre-wrap bg-background p-3 rounded border">
                      {compareData.v2.content}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Rules Changes */}
              {compareData.diff.rules.hasChanges && (
                <div>
                  <h3 className="font-semibold mb-3">Content Rules Changes</h3>
                  <div className="space-y-3">
                    {compareData.diff.rules.added.length > 0 && (
                      <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                          Added Rules ({compareData.diff.rules.added.length})
                        </p>
                        <ul className="text-xs space-y-1">
                          {compareData.diff.rules.added.map((rule) => (
                            <li key={rule} className="font-mono">
                              + {rule}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {compareData.diff.rules.removed.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
                        <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                          Removed Rules ({compareData.diff.rules.removed.length})
                        </p>
                        <ul className="text-xs space-y-1">
                          {compareData.diff.rules.removed.map((rule) => (
                            <li key={rule} className="font-mono">
                              - {rule}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {compareData.diff.rules.modified.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg">
                        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                          Modified Rules ({compareData.diff.rules.modified.length})
                        </p>
                        <div className="text-xs space-y-2">
                          {compareData.diff.rules.modified.map((mod) => (
                            <div key={mod.key} className="font-mono">
                              <p className="font-semibold">{mod.key}:</p>
                              <p className="text-red-600 dark:text-red-400">
                                - {JSON.stringify(mod.oldValue)}
                              </p>
                              <p className="text-green-600 dark:text-green-400">
                                + {JSON.stringify(mod.newValue)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!compareData.diff.rules.hasChanges && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No changes to content rules
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
