import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BarNotification {
  id: string;
  type: string;
  message: string;
  reviewId?: string;
  timestamp: string;
}

export default function BarNotificationBadge() {
  const [pendingCount, setPendingCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<BarNotification[]>([]);
  const { subscribe, isConnected } = useWebSocket();

  // Fetch initial pending count
  const { data: stats } = useQuery<{ pending: number }>({
    queryKey: ["/api/bar/stats"],
    refetchInterval: 60000, // Refetch every minute as fallback
  });

  // Update pending count from API
  useEffect(() => {
    if (stats?.pending !== undefined) {
      setPendingCount(stats.pending);
    }
  }, [stats]);

  // Subscribe to WebSocket BAR events for real-time updates
  useEffect(() => {
    const unsubscribeAssigned = subscribe("bar_review_assigned", (data) => {
      setPendingCount((prev) => prev + 1);
      
      // Add to recent notifications
      setRecentNotifications((prev) => [
        {
          id: data.reviewId || Date.now().toString(),
          type: "assigned",
          message: "New case review assigned",
          reviewId: data.reviewId,
          timestamp: new Date().toISOString(),
        },
        ...prev.slice(0, 4), // Keep last 5 notifications
      ]);
    });

    const unsubscribeCompleted = subscribe("bar_review_completed", (data) => {
      setPendingCount((prev) => Math.max(0, prev - 1));
    });

    const unsubscribeReminder = subscribe("bar_review_reminder", (data) => {
      // Add reminder notification
      setRecentNotifications((prev) => [
        {
          id: Date.now().toString(),
          type: "reminder",
          message: data.message || "Review deadline approaching",
          reviewId: data.reviewId,
          timestamp: new Date().toISOString(),
        },
        ...prev.slice(0, 4),
      ]);
    });

    return () => {
      unsubscribeAssigned();
      unsubscribeCompleted();
      unsubscribeReminder();
    };
  }, [subscribe]);

  // Don't show if no pending reviews
  if (pendingCount === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative text-white hover:text-white hover:bg-white/20"
          data-testid="button-bar-notifications"
        >
          <Bell className="h-4 w-4" />
          {pendingCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-pending-count"
            >
              {pendingCount > 9 ? '9+' : pendingCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end" data-testid="popover-notifications">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">BAR Reviews</h3>
            <Badge variant="destructive">{pendingCount} Pending</Badge>
          </div>
          
          {recentNotifications.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Recent Notifications</p>
              {recentNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className="text-sm border-l-2 border-primary pl-3 py-1"
                >
                  <p className="font-medium">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Button asChild className="w-full" data-testid="button-view-reviews">
            <Link href="/supervisor/reviews">
              View All Reviews
            </Link>
          </Button>

          {!isConnected && (
            <p className="text-xs text-muted-foreground text-center">
              ⚠️ Real-time updates disconnected
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
