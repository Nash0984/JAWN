import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Bot, Check } from "lucide-react";
import type { FeatureMetadata } from "@shared/featureMetadata";

interface FeatureCardProps {
  feature: FeatureMetadata;
}

export function FeatureCard({ feature }: FeatureCardProps) {
  return (
    <Card 
      className="h-full flex flex-col hover:shadow-lg transition-shadow"
      data-testid={`feature-card-${feature.id}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg flex-1" data-testid={`feature-title-${feature.id}`}>
            {feature.name}
          </CardTitle>
          {feature.aiPowered && (
            <Badge 
              variant="secondary" 
              className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 flex items-center gap-1"
              data-testid={`ai-badge-${feature.id}`}
            >
              <Bot className="h-3 w-3" />
              AI
            </Badge>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="text-xs" data-testid={`category-badge-${feature.id}`}>
            {feature.category}
          </Badge>
          {feature.status === 'production-ready' && (
            <Badge 
              variant="secondary" 
              className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 flex items-center gap-1"
              data-testid={`status-badge-${feature.id}`}
            >
              <Check className="h-3 w-3" />
              Production Ready
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription className="text-sm" data-testid={`feature-description-${feature.id}`}>
          {feature.description}
        </CardDescription>
        <div className="flex flex-wrap gap-1 mt-3">
          {feature.tags.slice(0, 4).map((tag) => (
            <Badge 
              key={tag} 
              variant="secondary" 
              className="text-xs bg-muted"
              data-testid={`tag-${feature.id}-${tag}`}
            >
              {tag}
            </Badge>
          ))}
          {feature.tags.length > 4 && (
            <Badge variant="secondary" className="text-xs bg-muted">
              +{feature.tags.length - 4}
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Link href={feature.route}>
          <Button 
            variant="outline" 
            className="w-full"
            data-testid={`explore-button-${feature.id}`}
          >
            Explore Feature
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
