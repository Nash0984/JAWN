import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type SkeletonType = "card" | "table" | "form" | "list" | "custom";

interface LoadingWrapperProps {
  isLoading: boolean;
  children: ReactNode;
  skeleton?: ReactNode;
  skeletonType?: SkeletonType;
  skeletonCount?: number;
  error?: Error | null;
  errorMessage?: string;
  errorFallback?: ReactNode;
  fallback?: ReactNode;
}

const CardSkeleton = () => (
  <Card data-testid="skeleton-card">
    <CardHeader>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3 mt-2" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </CardContent>
  </Card>
);

const TableSkeleton = () => (
  <div className="space-y-3" data-testid="skeleton-table">
    <div className="flex items-center space-x-4 border-b pb-3">
      <Skeleton className="h-4 w-1/6" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/5" />
      <Skeleton className="h-4 w-1/6" />
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center space-x-4">
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/5" />
        <Skeleton className="h-4 w-1/6" />
      </div>
    ))}
  </div>
);

const FormSkeleton = () => (
  <div className="space-y-4" data-testid="skeleton-form">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))}
    <Skeleton className="h-10 w-32 mt-6" />
  </div>
);

const ListSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3" data-testid="skeleton-list">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="flex items-center space-x-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const getDefaultSkeleton = (type: SkeletonType, count?: number): ReactNode => {
  switch (type) {
    case "card":
      return count ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(count)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <CardSkeleton />
      );
    case "table":
      return <TableSkeleton />;
    case "form":
      return <FormSkeleton />;
    case "list":
      return <ListSkeleton count={count} />;
    default:
      return <Skeleton className="h-64 w-full" data-testid="skeleton-custom" />;
  }
};

/**
 * LoadingWrapper - Unified loading state component
 * 
 * Eliminates duplicate loading logic across the application by providing
 * a consistent pattern for handling loading states, skeletons, and errors.
 * 
 * @example
 * // Basic usage with default card skeleton
 * <LoadingWrapper isLoading={isLoading}>
 *   <MyContent />
 * </LoadingWrapper>
 * 
 * @example
 * // With table skeleton
 * <LoadingWrapper isLoading={isLoading} skeletonType="table">
 *   <DataTable />
 * </LoadingWrapper>
 * 
 * @example
 * // With custom skeleton
 * <LoadingWrapper isLoading={isLoading} skeleton={<MyCustomSkeleton />}>
 *   <MyContent />
 * </LoadingWrapper>
 * 
 * @example
 * // With error handling (default Alert UI)
 * <LoadingWrapper 
 *   isLoading={isLoading} 
 *   error={error}
 *   errorMessage="Failed to load data"
 * >
 *   <MyContent />
 * </LoadingWrapper>
 * 
 * @example
 * // With custom error fallback (retry button, etc.)
 * <LoadingWrapper 
 *   isLoading={isLoading} 
 *   error={error}
 *   errorFallback={
 *     <div className="text-center p-8">
 *       <p className="text-destructive mb-4">Failed to load data</p>
 *       <Button onClick={refetch}>Retry</Button>
 *     </div>
 *   }
 * >
 *   <MyContent />
 * </LoadingWrapper>
 */
export function LoadingWrapper({
  isLoading,
  children,
  skeleton,
  skeletonType = "card",
  skeletonCount,
  error,
  errorMessage,
  errorFallback,
  fallback,
}: LoadingWrapperProps) {
  if (error) {
    if (errorFallback) {
      return <>{errorFallback}</>;
    }
    
    return (
      <Alert variant="destructive" data-testid="error-alert">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {errorMessage || error.message || "An error occurred while loading data"}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    if (skeleton) {
      return <>{skeleton}</>;
    }
    
    if (fallback) {
      return <>{fallback}</>;
    }

    return <>{getDefaultSkeleton(skeletonType, skeletonCount)}</>;
  }

  return <>{children}</>;
}
