import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { PolicyGlossaryTerm } from "@shared/schema";

interface GlossaryTooltipProps {
  term?: string;
  id?: string;
  children: React.ReactNode;
}

export function GlossaryTooltip({ term, id, children }: GlossaryTooltipProps) {
  const { data: glossaryTerm, isLoading } = useQuery<PolicyGlossaryTerm>({
    queryKey: id ? ['/api/policy-manual/glossary/id', id] : ['/api/policy-manual/glossary', term],
    enabled: !!(term || id),
  });

  if (!term && !id) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild data-testid={`glossary-tooltip-trigger-${term || id}`}>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          className="max-w-md p-4" 
          data-testid={`glossary-tooltip-content-${term || id}`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2" data-testid="glossary-tooltip-loading">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">Loading definition...</span>
            </div>
          ) : glossaryTerm ? (
            <div className="space-y-2" data-testid="glossary-tooltip-content">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-base" data-testid="glossary-tooltip-term">
                  {glossaryTerm.term}
                </h4>
                {glossaryTerm.acronym && (
                  <span 
                    className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded"
                    data-testid="glossary-tooltip-acronym"
                  >
                    {glossaryTerm.acronym}
                  </span>
                )}
              </div>
              
              {glossaryTerm.program && (
                <div 
                  className="text-xs text-muted-foreground"
                  data-testid="glossary-tooltip-program"
                >
                  Program: {glossaryTerm.program}
                </div>
              )}
              
              <p className="text-sm leading-relaxed" data-testid="glossary-tooltip-definition">
                {glossaryTerm.definition}
              </p>
              
              {glossaryTerm.legalCitation && (
                <div 
                  className="text-xs text-muted-foreground border-t pt-2 mt-2"
                  data-testid="glossary-tooltip-citation"
                >
                  <strong>Legal Citation:</strong> {glossaryTerm.legalCitation}
                </div>
              )}
              
              {glossaryTerm.examples && glossaryTerm.examples.length > 0 && (
                <div 
                  className="text-xs border-t pt-2 mt-2"
                  data-testid="glossary-tooltip-examples"
                >
                  <strong>Examples:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {glossaryTerm.examples.map((example, idx) => (
                      <li key={idx}>{example}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="glossary-tooltip-not-found">
              Definition not found
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
