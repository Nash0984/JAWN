import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Phone, Clock, Users, Building2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface County {
  id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  region: string;
  population?: number;
  coverage?: string[];
  enabledPrograms?: string[];
  welcomeMessage?: string;
  isActive: boolean;
}

interface CountyAssignment {
  countyId: string;
  role: string;
  isPrimary: boolean;
  accessLevel: string;
  county: County;
}

export function LDSSOfficeInfo() {
  const { data: assignments, isLoading } = useQuery<CountyAssignment[]>({
    queryKey: ["/api/users/me/county-assignments"],
  });

  const primaryOffice = assignments?.find((a) => a.isPrimary)?.county;

  if (isLoading) {
    return (
      <Card className="w-full" data-testid="ldss-office-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!primaryOffice) {
    return (
      <Card className="w-full border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950" data-testid="ldss-office-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
            <Building2 className="h-5 w-5" />
            No Office Assignment
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            You are not currently assigned to a Local Department of Social Services office. Contact your administrator for assignment.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const programNames: Record<string, string> = {
    "MD_SNAP": "SNAP (Food Assistance)",
    "MD_MEDICAID": "Medicaid",
    "MD_TANF": "TCA/TANF (Cash Assistance)",
    "MD_OHEP": "OHEP (Energy Assistance)",
    "MD_TAX_CREDITS": "Tax Credits",
    "VITA": "VITA Tax Assistance",
  };

  return (
    <Card className="w-full" data-testid="ldss-office-info">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {primaryOffice.name}
            </CardTitle>
            <CardDescription>
              {primaryOffice.region ? (
                <Badge variant="secondary" className="mt-2 capitalize">
                  {primaryOffice.region} Region
                </Badge>
              ) : null}
            </CardDescription>
          </div>
          {primaryOffice.isActive && (
            <Badge variant="default" className="bg-green-500">Active</Badge>
          )}
        </div>
        {primaryOffice.welcomeMessage && (
          <p className="text-sm text-muted-foreground mt-2" data-testid="office-welcome">
            {primaryOffice.welcomeMessage}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Contact Information */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Office Location & Contact
          </h3>
          <div className="pl-6 space-y-2 text-sm">
            <div className="flex items-start gap-2" data-testid="office-address">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-muted-foreground">{primaryOffice.address}</p>
              </div>
            </div>
            {primaryOffice.phone && (
              <div className="flex items-start gap-2" data-testid="office-phone">
                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Phone</p>
                  <a
                    href={`tel:${primaryOffice.phone}`}
                    className="text-primary hover:underline"
                  >
                    {primaryOffice.phone}
                  </a>
                </div>
              </div>
            )}
            {primaryOffice.email && (
              <div className="flex items-start gap-2" data-testid="office-email">
                <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email</p>
                  <a
                    href={`mailto:${primaryOffice.email}`}
                    className="text-primary hover:underline"
                  >
                    {primaryOffice.email}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Office Hours - Standard for all MD LDSS offices */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Office Hours
          </h3>
          <div className="pl-6 text-sm text-muted-foreground space-y-1" data-testid="office-hours">
            <p>Monday - Friday: 8:00 AM - 4:30 PM</p>
            <p className="text-xs">Closed on state and federal holidays</p>
          </div>
        </div>

        {/* Programs Offered */}
        {primaryOffice.enabledPrograms && primaryOffice.enabledPrograms.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Programs Available
            </h3>
            <div className="pl-6 flex flex-wrap gap-2" data-testid="office-programs">
              {primaryOffice.enabledPrograms.map((program) => (
                <Badge key={program} variant="outline">
                  {programNames[program] || program}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Service Area Coverage */}
        {primaryOffice.coverage && primaryOffice.coverage.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Service Area (ZIP Codes)
            </h3>
            <div className="pl-6 text-sm text-muted-foreground" data-testid="office-coverage">
              <p>{primaryOffice.coverage.slice(0, 10).join(", ")}
              {primaryOffice.coverage.length > 10 && ` (+${primaryOffice.coverage.length - 10} more)`}</p>
            </div>
          </div>
        )}

        {/* Population Served */}
        {primaryOffice.population && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Service Population
            </h3>
            <div className="pl-6 text-sm text-muted-foreground" data-testid="office-population">
              <p>Approximately {primaryOffice.population.toLocaleString()} residents</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t" data-testid="office-actions">
          <Button variant="outline" size="sm" asChild>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryOffice.address)}`} target="_blank" rel="noopener noreferrer">
              <MapPin className="h-4 w-4 mr-2" />
              Get Directions
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${primaryOffice.phone}`}>
              <Phone className="h-4 w-4 mr-2" />
              Call Office
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/appointments">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Visit
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
