import { useTenant } from "@/contexts/TenantContext";
import MarylandStateLawTracker from "./MarylandStateLawTracker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, AlertCircle } from "lucide-react";

/**
 * StateLawTracker - Tenant-aware wrapper for state-specific legislative tracking
 * 
 * Routes to the appropriate state-specific law tracker component based on tenant configuration.
 * Each state has unique legislative structures, bill numbering, session naming, and websites,
 * so state-specific implementations are necessary rather than generic white-labeling.
 * 
 * Implemented States:
 * - Maryland (MD): Maryland General Assembly tracker
 * 
 * Planned States:
 * - Pennsylvania (PA): PA General Assembly tracker
 * - Virginia (VA): VA General Assembly tracker  
 * - Utah (UT): UT State Legislature tracker
 * - Indiana (IN): IN General Assembly tracker
 * - Michigan (MI): MI Legislature tracker
 */
export default function StateLawTracker() {
  const { stateConfig } = useTenant();
  const stateCode = stateConfig?.stateCode || 'MD';
  const stateName = stateConfig?.stateName || 'Maryland';

  // Route to state-specific tracker
  switch (stateCode) {
    case 'MD':
      return <MarylandStateLawTracker />;
    
    // TODO: Add Pennsylvania tracker
    // case 'PA':
    //   return <PennsylvaniaStateLawTracker />;
    
    // TODO: Add Virginia tracker
    // case 'VA':
    //   return <VirginiaStateLawTracker />;
    
    // TODO: Add Utah tracker
    // case 'UT':
    //   return <UtahStateLawTracker />;
    
    // TODO: Add Indiana tracker
    // case 'IN':
    //   return <IndianaStateLawTracker />;
    
    // TODO: Add Michigan tracker
    // case 'MI':
    //   return <MichiganStateLawTracker />;
    
    default:
      return (
        <div className="container mx-auto max-w-4xl py-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              {stateName} State Law Tracker
            </h1>
            <p className="text-muted-foreground" data-testid="text-page-description">
              Track {stateName} state legislation affecting SNAP, Medicaid, TANF, and other benefit programs
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Legislative Tracker Not Available
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  State-specific legislative tracking for {stateName} is not yet implemented.
                  Each state requires a custom tracker due to unique legislative structures,
                  bill numbering systems, session naming conventions, and website scraping requirements.
                </AlertDescription>
              </Alert>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Currently Available:</strong> Maryland General Assembly tracker
                </p>
                <p>
                  <strong>Planned Implementation:</strong> Pennsylvania, Virginia, Utah, Indiana, Michigan
                </p>
                <p className="pt-2">
                  Federal legislative tracking (Congress.gov) is available under "Federal Law Tracker"
                  and applies universally to all states.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
  }
}
