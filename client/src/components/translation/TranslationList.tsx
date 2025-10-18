import { useQuery } from "@tanstack/react-query";
import { useTranslationFilters } from "@/stores/translationFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Edit, FileCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslationPermissions } from "@/hooks/useTranslationPermissions";
import { Skeleton } from "@/components/ui/skeleton";

interface TranslationListProps {
  onSelectKey: (keyId: string) => void;
}

export function TranslationList({ onSelectKey }: TranslationListProps) {
  const { filters, setNamespace, setLocale, setStatus, setSearch, setPage, resetFilters } = useTranslationFilters();
  const permissions = useTranslationPermissions();

  // Fetch locales
  const { data: locales } = useQuery({
    queryKey: ['/api/locales'],
  });

  // Fetch translations
  const { data: translationsData, isLoading } = useQuery({
    queryKey: ['/api/translations', filters],
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending_review: { variant: "default", label: "Pending Review" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant} data-testid={`status-${status}`}>{config.label}</Badge>;
  };

  const handleRowClick = (keyId: string) => {
    onSelectKey(keyId);
  };

  const namespaces = ['common', 'tax', 'benefits', 'legal']; // TODO: fetch from API

  return (
    <Card>
      <CardHeader>
        <CardTitle>Translation Keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search translations..."
              value={filters.search}
              onChange={handleSearch}
              className="pl-8"
              data-testid="input-search"
            />
          </div>
          
          <Select value={filters.namespace} onValueChange={setNamespace}>
            <SelectTrigger data-testid="select-namespace">
              <SelectValue placeholder="All Namespaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Namespaces</SelectItem>
              {namespaces.map((ns) => (
                <SelectItem key={ns} value={ns}>{ns}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.targetLocaleId} onValueChange={setLocale}>
            <SelectTrigger data-testid="select-locale">
              <SelectValue placeholder="Select Locale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Locales</SelectItem>
              {locales?.map((locale: any) => (
                <SelectItem key={locale.id} value={locale.id}>
                  {locale.name} ({locale.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={setStatus}>
            <SelectTrigger data-testid="select-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Namespace</TableHead>
                  <TableHead>Default Text</TableHead>
                  <TableHead>Current Translation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {translationsData?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No translations found
                    </TableCell>
                  </TableRow>
                ) : (
                  translationsData?.data?.map((translation: any) => (
                    <TableRow
                      key={translation.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(translation.id)}
                      data-testid={`row-translation-${translation.id}`}
                    >
                      <TableCell className="font-mono text-sm">{translation.key}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{translation.namespace}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={translation.defaultText}>
                        {translation.defaultText}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {translation.currentVersion?.translatedText || (
                          <span className="text-muted-foreground italic">Not translated</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {translation.currentVersion?.status
                          ? getStatusBadge(translation.currentVersion.status)
                          : <Badge variant="outline">No version</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        {translation.currentVersion?.qualityScore ? (
                          <span className="font-medium">
                            {Math.round(translation.currentVersion.qualityScore * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {translation.assignedTranslator ? (
                          <div className="text-sm">
                            <div className="font-medium">{translation.assignedTranslator.fullName}</div>
                            <div className="text-muted-foreground text-xs">Translator</div>
                          </div>
                        ) : translation.assignedReviewer ? (
                          <div className="text-sm">
                            <div className="font-medium">{translation.assignedReviewer.fullName}</div>
                            <div className="text-muted-foreground text-xs">Reviewer</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {permissions.canEditTranslations && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectKey(translation.id);
                              }}
                              data-testid={`button-edit-${translation.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {permissions.canReviewTranslations && translation.currentVersion?.status === 'pending_review' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectKey(translation.id);
                              }}
                              data-testid={`button-review-${translation.id}`}
                            >
                              <FileCheck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {translationsData?.pagination && translationsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((translationsData.pagination.page - 1) * translationsData.pagination.limit) + 1} to{' '}
                  {Math.min(
                    translationsData.pagination.page * translationsData.pagination.limit,
                    translationsData.pagination.totalCount
                  )}{' '}
                  of {translationsData.pagination.totalCount} translations
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={translationsData.pagination.page === 1}
                    onClick={() => setPage(translationsData.pagination.page - 1)}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={translationsData.pagination.page >= translationsData.pagination.totalPages}
                    onClick={() => setPage(translationsData.pagination.page + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
