import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Award, Target, DollarSign, Zap } from "lucide-react";

interface NavigatorAchievement {
  id: string;
  navigatorId: string;
  achievementId: string;
  triggerMetric: string;
  triggerValue: number;
  notified: boolean;
  earnedAt: string;
  achievement: {
    id: string;
    name: string;
    description: string;
    tier: string;
    iconName: string;
    iconColor: string;
    pointsAwarded: number;
  };
}

const iconMap: Record<string, any> = {
  Trophy,
  Award,
  Target,
  DollarSign,
  Zap,
};

export function AchievementNotificationProvider({ navigatorId }: { navigatorId: string }) {
  const { toast } = useToast();

  // Poll for unnotified achievements every 10 seconds
  const { data: unnotifiedAchievements } = useQuery<NavigatorAchievement[]>({
    queryKey: ['/api/navigators', navigatorId, 'achievements', 'unnotified'],
    refetchInterval: 10000, // Poll every 10 seconds
    enabled: !!navigatorId,
  });

  // Mutation to mark achievements as notified
  const markNotifiedMutation = useMutation({
    mutationFn: async (achievementIds: string[]) => {
      const res = await apiRequest('POST', '/api/navigator-achievements/mark-notified', {
        achievementIds,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/navigators', navigatorId, 'achievements', 'unnotified'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/navigators', navigatorId, 'achievements'] 
      });
    },
  });

  // Show toast notifications for new achievements
  useEffect(() => {
    if (unnotifiedAchievements && unnotifiedAchievements.length > 0) {
      unnotifiedAchievements.forEach((achievement) => {
        const Icon = iconMap[achievement.achievement.iconName] || Trophy;
        
        toast({
          title: (
            <div className="flex items-center gap-2">
              <Icon 
                className="h-5 w-5" 
                style={{ color: achievement.achievement.iconColor }}
              />
              <span>Achievement Unlocked!</span>
            </div>
          ) as any,
          description: (
            <div className="space-y-1">
              <p className="font-semibold">{achievement.achievement.name}</p>
              <p className="text-sm text-muted-foreground">
                {achievement.achievement.description}
              </p>
              <p className="text-xs text-primary">
                +{achievement.achievement.pointsAwarded} points
              </p>
            </div>
          ) as any,
          duration: 5000,
        });
      });

      // Mark as notified
      const achievementIds = unnotifiedAchievements.map(a => a.id);
      markNotifiedMutation.mutate(achievementIds);
    }
  }, [unnotifiedAchievements]);

  return null; // This is a headless component
}
