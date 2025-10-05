import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Construction } from "lucide-react";

export function CategoricalEligibilityManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorical Eligibility</CardTitle>
        <CardDescription>
          Manage categorical eligibility rules for SSI, TANF, and other programs (Manual Section 110)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <Construction className="h-4 w-4" />
          <AlertDescription>
            Categorical eligibility management UI coming soon. This will allow you to configure auto-qualification rules for households receiving other benefits.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
