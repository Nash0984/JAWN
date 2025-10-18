import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock, AlertCircle, CheckCircle2, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { FeedbackFeature } from "@shared/schema";

interface TrendingEntry {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  viewCount: number;
  featureName: string;
  trendScore: number;
  createdAt: string;
}

interface FeedbackMetrics {
  totalSubmissions: number;
  resolvedCount: number;
  backlogCount: number;
  resolutionRate: number;
  avgResolutionTimeHours: number;
  sentimentDistribution: Array<{ sentiment: string; count: number }>;
  topFeatures: Array<{ featureId: string; featureName: string; count: number }>;
}

export default function FeedbackDashboard() {
  const { user } = useUser();
  const [selectedFeature, setSelectedFeature] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: features } = useQuery<FeedbackFeature[]>({
    queryKey: ["/api/feedback/features"],
  });

  const { data: trending } = useQuery<TrendingEntry[]>({
    queryKey: ["/api/feedback/trending", selectedFeature],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "10" });
      if (selectedFeature !== "all") params.append("featureId", selectedFeature);
      const response = await fetch(`/api/feedback/trending?${params}`);
      if (!response.ok) throw new Error("Failed to fetch trending feedback");
      return response.json();
    },
  });

  const { data: metrics } = useQuery<FeedbackMetrics>({
    queryKey: ["/api/feedback/metrics", selectedFeature],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFeature !== "all") params.append("featureId", selectedFeature);
      const response = await fetch(`/api/feedback/metrics?${params}`);
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return response.json();
    },
  });

  const sentimentData = metrics?.sentimentDistribution.map((s) => ({
    name: s.sentiment.charAt(0).toUpperCase() + s.sentiment.slice(1),
    value: s.count,
  })) || [];

  const COLORS = {
    Positive: "#10b981",
    Neutral: "#6b7280",
    Negative: "#ef4444",
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "resolved":
        return "default";
      case "in_progress":
        return "secondary";
      case "under_review":
        return "outline";
      default:
        return "outline";
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!user || !["navigator", "caseworker", "admin", "super_admin"].includes(user.role)) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view the feedback dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-feedback-dashboard">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Feedback Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage platform feedback</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedFeature} onValueChange={setSelectedFeature}>
            <SelectTrigger className="w-[200px]" data-testid="select-feature-filter">
              <SelectValue placeholder="All Features" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Features</SelectItem>
              {features?.map((feature) => (
                <SelectItem key={feature.id} value={feature.id}>
                  {feature.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-submissions">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-submissions">{metrics?.totalSubmissions || 0}</div>
            <p className="text-xs text-muted-foreground">All-time feedback entries</p>
          </CardContent>
        </Card>

        <Card data-testid="card-resolved">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resolved">{metrics?.resolvedCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.resolutionRate ? `${(metrics.resolutionRate * 100).toFixed(1)}% resolution rate` : "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-backlog">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backlog</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-backlog">{metrics?.backlogCount || 0}</div>
            <p className="text-xs text-muted-foreground">Pending resolution</p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-resolution">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-resolution">
              {metrics?.avgResolutionTimeHours ? `${metrics.avgResolutionTimeHours.toFixed(1)}h` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">Time to resolution</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-trending-issues">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>Trending Issues</CardTitle>
            </div>
            <CardDescription>Top 10 feedback entries by trend score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trending?.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/feedback/${entry.id}`}
                  className="block"
                  data-testid={`link-feedback-${entry.id}`}
                >
                  <div className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold line-clamp-1">{entry.title}</h4>
                      <Badge variant="outline">{entry.trendScore.toFixed(2)}</Badge>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Badge variant={getStatusBadgeVariant(entry.status)}>{entry.status}</Badge>
                      <Badge variant={getPriorityBadgeVariant(entry.priority)}>{entry.priority}</Badge>
                      <Badge variant="outline">{entry.featureName}</Badge>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>👍 {entry.upvotes}</span>
                      <span>👎 {entry.downvotes}</span>
                      <span>💬 {entry.commentCount}</span>
                      <span>👁 {entry.viewCount}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {(!trending || trending.length === 0) && (
                <p className="text-center text-muted-foreground py-8">No trending feedback found</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-sentiment-distribution">
          <CardHeader>
            <CardTitle>Sentiment Distribution</CardTitle>
            <CardDescription>Overall sentiment analysis of feedback</CardDescription>
          </CardHeader>
          <CardContent>
            {sentimentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sentimentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No sentiment data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
