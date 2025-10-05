import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Construction } from "lucide-react";

export function DeductionsManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deductions</CardTitle>
        <CardDescription>
          Manage standard, earned income, dependent care, medical, and shelter deductions (Manual Section 200)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <Construction className="h-4 w-4" />
          <AlertDescription>
            Deductions management UI coming soon. This will allow you to configure all SNAP deduction rules.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
