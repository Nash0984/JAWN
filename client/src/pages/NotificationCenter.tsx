import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Search, Check, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export default function NotificationCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, isLoading } = useQuery<{ notifications: Notification[]; total: number }>({
    queryKey: ["/api/notifications", filter, page, searchQuery, typeFilter],
    queryFn: () =>
      fetch(
        `/api/notifications?limit=${limit}&offset=${offset}&unreadOnly=${filter === "unread" ? "true" : "false"}&search=${encodeURIComponent(searchQuery)}&type=${typeFilter}`,
        { credentials: "include" }
      ).then((res) => res.json()),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
  });

  const notifications = data?.notifications || [];

  // Reset to page 1 when filters change
  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleTypeFilterChange = (newTypeFilter: string) => {
    setTypeFilter(newTypeFilter);
    setPage(1);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearchQuery(newSearch);
    setPage(1);
  };

  // Notifications are already filtered by the backend
  const filteredNotifications = notifications;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      default:
        return "secondary";
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "Urgent";
      case "high":
        return "High";
      case "normal":
        return "Normal";
      default:
        return "Low";
    }
  };

  const getTypeLabel = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <a href="#notification-content" className="skip-link">
        Skip to notifications
      </a>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notifications</h1>
        <p className="text-muted-foreground">
          Stay updated with important alerts and system notifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Center
              </CardTitle>
              <CardDescription>
                {data?.total || 0} total notification{data?.total !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending || notifications.every((n) => n.isRead)}
                data-testid="button-mark-all-read"
              >
                <Check className="h-4 w-4 mr-2" />
                Mark all read
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent id="notification-content">
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                <SelectTrigger className="w-full md:w-[200px]" data-testid="select-type">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="policy_change">Policy Changes</SelectItem>
                  <SelectItem value="feedback_new">Feedback</SelectItem>
                  <SelectItem value="rule_extraction_complete">Rule Extraction</SelectItem>
                  <SelectItem value="navigator_assignment">Navigator</SelectItem>
                  <SelectItem value="system_alert">System Alerts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tabs for filter */}
            <Tabs value={filter} onValueChange={(v) => handleFilterChange(v as any)}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="unread" data-testid="tab-unread">Unread</TabsTrigger>
                <TabsTrigger value="read" data-testid="tab-read">Read</TabsTrigger>
              </TabsList>

              <TabsContent value={filter} className="mt-6">
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="h-16 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-no-notifications">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No notifications found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotifications.map((notification) => (
                      <Card
                        key={notification.id}
                        className={`${
                          !notification.isRead ? "border-primary bg-accent/50" : ""
                        } transition-all hover:shadow-md`}
                        data-testid={`notification-card-${notification.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={getPriorityColor(notification.priority)}>
                                  {getPriorityText(notification.priority)}
                                </Badge>
                                <Badge variant="outline">{getTypeLabel(notification.type)}</Badge>
                                {!notification.isRead && (
                                  <div className="w-2 h-2 bg-primary rounded-full" />
                                )}
                              </div>
                              <h3 className="font-semibold text-lg mb-1">
                                {notification.title}
                              </h3>
                              <p className="text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.createdAt), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => markReadMutation.mutate(notification.id)}
                                  disabled={markReadMutation.isPending}
                                  data-testid={`button-mark-read-${notification.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              {notification.actionUrl && (
                                <Link href={notification.actionUrl}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (!notification.isRead) {
                                        markReadMutation.mutate(notification.id);
                                      }
                                    }}
                                    data-testid={`button-view-${notification.id}`}
                                  >
                                    View
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                
                {/* Pagination */}
                {filteredNotifications.length > 0 && data && data.total > limit && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      Showing {offset + 1}-{Math.min(offset + limit, data.total)} of {data.total}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1 px-4">
                        <span className="text-sm">
                          Page {page} of {Math.ceil(data.total / limit)}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= Math.ceil(data.total / limit)}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
