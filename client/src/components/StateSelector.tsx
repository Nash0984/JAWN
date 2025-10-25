import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute, useParams } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building, Globe } from "lucide-react";

interface StateConfig {
  id: string;
  stateCode: string;
  stateName: string;
  abbreviation: string;
  region: string;
  agencyName: string;
  agencyAcronym: string;
  isActive: boolean;
  features?: {
    enableVita?: boolean;
    enableSms?: boolean;
    enableChat?: boolean;
    enableAppointments?: boolean;
    enableDocumentUpload?: boolean;
  };
}

interface StateSelectorInfo {
  id: string;
  stateCode: string;
  stateName: string;
  abbreviation: string;
  region: string;
  agencyAcronym: string;
  isActive: boolean;
  programCount: number;
  tenantId?: string;
}

export function StateSelector() {
  const [, setLocation] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  // Get current state from URL
  const currentPath = window.location.pathname;
  const stateMatch = currentPath.match(/^\/([a-z]+)\//);
  const currentStateCode = stateMatch ? stateMatch[1].toUpperCase() : "MD"; // Default to Maryland

  // Fetch available states
  const { data: states, isLoading } = useQuery<StateSelectorInfo[]>({
    queryKey: ["/api/states/selector"],
    enabled: true,
  });

  // Group states by region for better organization
  const statesByRegion = states?.reduce((acc, state) => {
    const region = state.region || "Other";
    if (!acc[region]) {
      acc[region] = [];
    }
    acc[region].push(state);
    return acc;
  }, {} as Record<string, StateSelectorInfo[]>) || {};

  const handleStateChange = (stateCode: string) => {
    // Get current path without state prefix
    let newPath = currentPath;
    if (stateMatch) {
      newPath = currentPath.substring(stateMatch[0].length - 1);
    }
    
    // Navigate to new state-specific path
    const newUrl = `/${stateCode.toLowerCase()}${newPath}`;
    setLocation(newUrl);
    setIsModalOpen(false);
    
    // Reload to apply new state context
    window.location.href = newUrl;
  };

  const currentStateInfo = states?.find(s => s.stateCode === currentStateCode);

  return (
    <>
      {/* State Selector Button in Header */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2"
        data-testid="button-state-selector"
      >
        <MapPin className="h-4 w-4" />
        <span className="font-medium">{currentStateCode}</span>
        <span className="text-muted-foreground hidden md:inline">
          {currentStateInfo?.stateName}
        </span>
      </Button>

      {/* State Selection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto" data-testid="dialog-state-selector">
          <DialogHeader>
            <DialogTitle>Select Your State</DialogTitle>
            <DialogDescription>
              Choose the state where you're applying for benefits. Each state has its own programs and requirements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Quick Select Dropdown */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quick Select</label>
              <Select
                value={selectedState || currentStateCode}
                onValueChange={(value) => {
                  setSelectedState(value);
                  handleStateChange(value);
                }}
              >
                <SelectTrigger data-testid="select-state-dropdown">
                  <SelectValue placeholder="Choose a state" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statesByRegion).map(([region, regionStates]) => (
                    <SelectGroup key={region}>
                      <SelectLabel>{region}</SelectLabel>
                      {regionStates
                        .filter(state => state.isActive)
                        .sort((a, b) => a.stateName.localeCompare(b.stateName))
                        .map((state) => (
                          <SelectItem
                            key={state.id}
                            value={state.stateCode}
                            data-testid={`option-state-${state.stateCode}`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{state.stateName} ({state.abbreviation})</span>
                              {state.programCount > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                  {state.programCount} programs
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* State Cards Grid */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Available States</h3>
              {Object.entries(statesByRegion).map(([region, regionStates]) => (
                <div key={region} className="space-y-2">
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {region}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {regionStates
                      .filter(state => state.isActive)
                      .sort((a, b) => a.stateName.localeCompare(b.stateName))
                      .map((state) => (
                        <Card
                          key={state.id}
                          className={`cursor-pointer transition-colors hover:border-primary ${
                            state.stateCode === currentStateCode ? "border-primary bg-primary/5" : ""
                          }`}
                          onClick={() => handleStateChange(state.stateCode)}
                          data-testid={`card-state-${state.stateCode}`}
                        >
                          <CardHeader className="p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-sm">
                                  {state.abbreviation}
                                </CardTitle>
                                <CardDescription className="text-xs">
                                  {state.stateName}
                                </CardDescription>
                              </div>
                              {state.stateCode === currentStateCode && (
                                <Badge variant="default" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-0">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building className="h-3 w-3" />
                              <span>{state.agencyAcronym}</span>
                            </div>
                            {state.programCount > 0 && (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {state.programCount} programs
                                </Badge>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Current Selection Info */}
            {currentStateInfo && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Currently viewing:</span>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="font-medium">
                      {currentStateInfo.stateName} ({currentStateInfo.stateCode})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Mini version for mobile/compact views
export function StateSelectorCompact() {
  const [, setLocation] = useLocation();
  
  // Get current state from URL
  const currentPath = window.location.pathname;
  const stateMatch = currentPath.match(/^\/([a-z]+)\//);
  const currentStateCode = stateMatch ? stateMatch[1].toUpperCase() : "MD";

  // Fetch available states
  const { data: states } = useQuery<StateSelectorInfo[]>({
    queryKey: ["/api/states/selector"],
  });

  const handleStateChange = (stateCode: string) => {
    // Get current path without state prefix
    let newPath = currentPath;
    if (stateMatch) {
      newPath = currentPath.substring(stateMatch[0].length - 1);
    }
    
    // Navigate to new state-specific path
    const newUrl = `/${stateCode.toLowerCase()}${newPath}`;
    window.location.href = newUrl;
  };

  if (!states || states.length === 0) return null;

  return (
    <Select
      value={currentStateCode}
      onValueChange={handleStateChange}
    >
      <SelectTrigger className="w-[100px]" data-testid="select-state-compact">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {states
          .filter(state => state.isActive)
          .sort((a, b) => a.stateName.localeCompare(b.stateName))
          .map((state) => (
            <SelectItem
              key={state.id}
              value={state.stateCode}
              data-testid={`option-state-compact-${state.stateCode}`}
            >
              {state.abbreviation}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}