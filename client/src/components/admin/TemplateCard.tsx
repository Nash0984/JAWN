import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Edit, Power } from "lucide-react";
import { useLocation } from "wouter";
import type { DynamicNotificationTemplate } from "@shared/schema";

interface TemplateCardProps {
  template: DynamicNotificationTemplate & { usageCount?: number };
  onViewUsage: (templateId: string) => void;
  onToggleStatus?: (templateId: string, currentStatus: boolean) => void;
}

export function TemplateCard({ template, onViewUsage, onToggleStatus }: TemplateCardProps) {
  const [, navigate] = useLocation();

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <Card className="h-full flex flex-col" data-testid={`template-card-${template.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate" data-testid={`template-name-${template.id}`}>
              {template.templateName}
            </CardTitle>
            <CardDescription className="text-sm mt-1" data-testid={`template-code-${template.id}`}>
              {template.templateCode}
            </CardDescription>
          </div>
          <Badge 
            variant={template.isActive ? "default" : "secondary"}
            data-testid={`template-status-${template.id}`}
          >
            {template.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Program</p>
            <Badge variant="outline" className="mt-1" data-testid={`template-program-${template.id}`}>
              {template.program}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Notice Type</p>
            <p className="font-medium capitalize" data-testid={`template-notice-type-${template.id}`}>
              {template.noticeType?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Usage Count</p>
            <p className="font-semibold text-lg" data-testid={`template-usage-${template.id}`}>
              {template.usageCount ?? 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Updated</p>
            <p className="font-medium" data-testid={`template-updated-${template.id}`}>
              {formatDate(template.updatedAt)}
            </p>
          </div>
        </div>

        {template.deliveryChannels && template.deliveryChannels.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Channels</p>
            <div className="flex flex-wrap gap-1">
              {template.deliveryChannels.map((channel) => (
                <Badge key={channel} variant="secondary" className="text-xs">
                  {channel}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => navigate(`/admin/form-builder?templateId=${template.id}`)}
          data-testid={`button-edit-${template.id}`}
        >
          <Edit className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onViewUsage(template.id)}
          data-testid={`button-view-usage-${template.id}`}
        >
          <Eye className="h-3 w-3 mr-1" />
          Usage
        </Button>
        {onToggleStatus && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleStatus(template.id, template.isActive)}
            data-testid={`button-toggle-status-${template.id}`}
          >
            <Power className="h-3 w-3" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
