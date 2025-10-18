import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PolicyGlossaryTerm } from "@shared/schema";

interface AutocompleteResult {
  id: string;
  term: string;
  definition_preview: string;
  program: string | null;
  acronym: string | null;
}

interface GlossaryAutocompleteProps {
  onSelect: (term: PolicyGlossaryTerm) => void;
  placeholder?: string;
  className?: string;
}

export function GlossaryAutocomplete({ 
  onSelect, 
  placeholder = "Search policy terms...",
  className 
}: GlossaryAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<AutocompleteResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  const { data: autocompleteResults = [], isLoading } = useQuery<AutocompleteResult[]>({
    queryKey: ['/api/policy-manual/glossary/autocomplete', debouncedSearch],
    enabled: debouncedSearch.length >= 2,
  });

  const { data: fullTerm } = useQuery<PolicyGlossaryTerm>({
    queryKey: ['/api/policy-manual/glossary/id', selectedTerm?.id],
    enabled: !!selectedTerm?.id,
  });

  useEffect(() => {
    if (fullTerm) {
      onSelect(fullTerm);
    }
  }, [fullTerm, onSelect]);

  const handleSelect = (result: AutocompleteResult) => {
    setSelectedTerm(result);
    setSearchValue(result.term);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          data-testid="glossary-autocomplete-trigger"
        >
          {selectedTerm ? selectedTerm.term : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" data-testid="glossary-autocomplete-popover">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid="glossary-autocomplete-input"
          />
          <CommandList>
            {isLoading ? (
              <div 
                className="flex items-center justify-center p-4"
                data-testid="glossary-autocomplete-loading"
              >
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : searchValue.length < 2 ? (
              <CommandEmpty data-testid="glossary-autocomplete-prompt">
                Type at least 2 characters to search
              </CommandEmpty>
            ) : autocompleteResults.length === 0 ? (
              <CommandEmpty data-testid="glossary-autocomplete-empty">
                No terms found
              </CommandEmpty>
            ) : (
              <CommandGroup data-testid="glossary-autocomplete-results">
                {autocompleteResults.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.term}
                    onSelect={() => handleSelect(result)}
                    className="flex flex-col items-start gap-1 py-3"
                    data-testid={`glossary-autocomplete-item-${result.id}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selectedTerm?.id === result.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <span 
                          className="font-medium"
                          data-testid={`glossary-autocomplete-term-${result.id}`}
                        >
                          {result.term}
                        </span>
                        {result.acronym && (
                          <span 
                            className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded"
                            data-testid={`glossary-autocomplete-acronym-${result.id}`}
                          >
                            {result.acronym}
                          </span>
                        )}
                        {result.program && (
                          <span 
                            className="text-xs text-muted-foreground"
                            data-testid={`glossary-autocomplete-program-${result.id}`}
                          >
                            ({result.program})
                          </span>
                        )}
                      </div>
                    </div>
                    <p 
                      className="text-xs text-muted-foreground ml-6 line-clamp-2"
                      data-testid={`glossary-autocomplete-preview-${result.id}`}
                    >
                      {result.definition_preview}
                      {result.definition_preview.length >= 100 && '...'}
                    </p>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
