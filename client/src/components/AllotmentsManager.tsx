import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Construction } from "lucide-react";

export function AllotmentsManager() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Benefit Allotments</CardTitle>
        <CardDescription>
          Manage monthly benefit amounts by household size (Manual Section 350)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <Construction className="h-4 w-4" />
          <AlertDescription>
            Allotments management UI coming soon. This will allow you to configure benefit amounts by household size.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
