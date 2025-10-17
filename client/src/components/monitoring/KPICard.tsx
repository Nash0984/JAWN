import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon?: React.ReactNode;
  status?: 'critical' | 'warning' | 'healthy';
  testId?: string;
}

export function KPICard({ title, value, trend, trendValue, icon, status, testId }: KPICardProps) {
  const getStatusColor = () => {
    if (!status) return '';
    switch (status) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'healthy':
        return 'border-green-500 bg-green-50 dark:bg-green-950/20';
      default:
        return '';
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />;
      case 'down':
        return <TrendingDown className="h-4 w-4" />;
      case 'stable':
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400';
      case 'down':
        return 'text-red-600 dark:text-red-400';
      case 'stable':
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <Card className={`p-4 ${getStatusColor()}`} data-testid={testId}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1" data-testid={`${testId}-title`}>
            {title}
          </p>
          <p className="text-2xl font-bold" data-testid={`${testId}-value`}>
            {value}
          </p>
          {trendValue && (
            <div className={`flex items-center gap-1 text-sm mt-1 ${getTrendColor()}`} data-testid={`${testId}-trend`}>
              {getTrendIcon()}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-muted-foreground" data-testid={`${testId}-icon`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
