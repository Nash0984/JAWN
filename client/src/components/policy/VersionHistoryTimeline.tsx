import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, User, Eye, GitCompare, Clock } from "lucide-react";
import { format } from "date-fns";
import VersionCompareDialog from "./VersionCompareDialog";

interface VersionHistoryTimelineProps {
  sectionId: string;
  sectionTitle: string;
  currentContent?: string;
}

interface Version {
  id: string;
  sectionId: string;
  versionNumber: number;
  changeSummary: string;
  effectiveDate: string;
  createdAt: string;
  changedByUser: {
    id: string;
    username: string;
    fullName: string | null;
  } | null;
}

export default function VersionHistoryTimeline({
  sectionId,
  sectionTitle,
  currentContent,
}: VersionHistoryTimelineProps) {
  const [selectedVersionForCompare, setSelectedVersionForCompare] = useState<Version | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const { data: versions, isLoading } = useQuery<Version[]>({
    queryKey: ['/api/policy-manual/sections', sectionId, 'versions'],
  });

  const handleCompare = (version: Version) => {
    setSelectedVersionForCompare(version);
    setCompareDialogOpen(true);
  };

  const handleView = (version: Version) => {
    // TODO: Implement view version in modal
    console.log('View version:', version);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
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
            This section doesn't have any version history yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold mb-1">Version History</h2>
        <p className="text-sm text-muted-foreground">{sectionTitle}</p>
        <Badge variant="outline" className="mt-2">
          {versions.length} {versions.length === 1 ? 'version' : 'versions'}
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[13px] top-6 bottom-6 w-px bg-border" />

            <div className="space-y-8">
              {versions.map((version, index) => (
                <div key={version.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-1 w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                      index === 0
                        ? 'bg-primary border-primary'
                        : 'bg-background border-border'
                    }`}
                  >
                    {index === 0 ? (
                      <Calendar className="h-4 w-4 text-primary-foreground" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                    )}
                  </div>

                  {/* Version card */}
                  <div className="bg-card border rounded-lg p-4 space-y-3">
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
                          {version.changeSummary}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(version.effectiveDate), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {version.changedByUser && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>
                                {version.changedByUser.fullName || version.changedByUser.username}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(version)}
                        data-testid={`button-view-version-${version.versionNumber}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </Button>
                      {index > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCompare(version)}
                          data-testid={`button-compare-version-${version.versionNumber}`}
                        >
                          <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                          Compare
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {selectedVersionForCompare && (
        <VersionCompareDialog
          open={compareDialogOpen}
          onOpenChange={setCompareDialogOpen}
          sectionId={sectionId}
          sectionTitle={sectionTitle}
          oldVersionId={selectedVersionForCompare.id}
          oldVersionNumber={selectedVersionForCompare.versionNumber}
          oldVersionDate={selectedVersionForCompare.effectiveDate}
          newVersionNumber={versions[0]?.versionNumber || 0}
          newVersionDate={versions[0]?.effectiveDate || ''}
        />
      )}
    </div>
  );
}
