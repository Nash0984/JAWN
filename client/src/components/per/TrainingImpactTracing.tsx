import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  ArrowRight,
  Play,
  Pause,
  RefreshCw,
  Award,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrainingIntervention {
  id: string;
  name: string;
  description: string;
  errorCategory: string;
  targetedCaseworkers: string[];
  startDate: string;
  endDate?: string;
  status: 'planned' | 'active' | 'completed';
  preTrainingErrorRate: number;
  postTrainingErrorRate?: number;
  impactPercentage?: number;
}

interface TrainingMetrics {
  totalInterventions: number;
  activeInterventions: number;
  completedInterventions: number;
  averageImpact: number;
  caseworkersTrained: number;
  errorReductionAchieved: number;
}

interface ErrorTrendData {
  period: string;
  errorRate: number;
  trainingIntervention?: string;
}

const ERROR_CATEGORIES = [
  { value: 'wages_salaries', label: 'Wages & Salaries' },
  { value: 'shelter_deduction', label: 'Shelter Deduction' },
  { value: 'household_composition', label: 'Household Composition' },
  { value: 'abawd_time_limits', label: 'ABAWD Time Limits' },
  { value: 'resource_limits', label: 'Resource Limits' },
  { value: 'medical_deduction', label: 'Medical Deduction' },
];

const MOCK_INTERVENTIONS: TrainingIntervention[] = [
  {
    id: '1',
    name: 'Income Verification Best Practices',
    description: 'Training on proper wage documentation and verification procedures per 7 CFR 273.2(f)',
    errorCategory: 'wages_salaries',
    targetedCaseworkers: ['cw-001', 'cw-002', 'cw-003'],
    startDate: '2024-01-15',
    endDate: '2024-02-15',
    status: 'completed',
    preTrainingErrorRate: 8.2,
    postTrainingErrorRate: 4.1,
    impactPercentage: 50,
  },
  {
    id: '2',
    name: 'Shelter Cost Documentation Workshop',
    description: 'Workshop on shelter deduction calculations and required documentation per COMAR 07.03.17.04',
    errorCategory: 'shelter_deduction',
    targetedCaseworkers: ['cw-004', 'cw-005'],
    startDate: '2024-02-01',
    endDate: '2024-02-28',
    status: 'completed',
    preTrainingErrorRate: 12.5,
    postTrainingErrorRate: 6.8,
    impactPercentage: 46,
  },
  {
    id: '3',
    name: 'ABAWD Compliance Refresher',
    description: 'Refresher on ABAWD time limits and exemption categories per 7 CFR 273.24',
    errorCategory: 'abawd_time_limits',
    targetedCaseworkers: ['cw-001', 'cw-006', 'cw-007', 'cw-008'],
    startDate: '2024-03-01',
    status: 'active',
    preTrainingErrorRate: 6.3,
  },
];

const MOCK_TREND_DATA: ErrorTrendData[] = [
  { period: 'Q1 2023', errorRate: 9.8 },
  { period: 'Q2 2023', errorRate: 9.2 },
  { period: 'Q3 2023', errorRate: 8.7 },
  { period: 'Q4 2023', errorRate: 8.2, trainingIntervention: 'Income Verification Training' },
  { period: 'Q1 2024', errorRate: 5.8 },
  { period: 'Q2 2024', errorRate: 4.9, trainingIntervention: 'Shelter Documentation Workshop' },
  { period: 'Q3 2024', errorRate: 4.1 },
];

export default function TrainingImpactTracing() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showNewInterventionDialog, setShowNewInterventionDialog] = useState(false);
  const [newIntervention, setNewIntervention] = useState({
    name: '',
    description: '',
    errorCategory: '',
    startDate: '',
  });

  const metrics: TrainingMetrics = {
    totalInterventions: MOCK_INTERVENTIONS.length,
    activeInterventions: MOCK_INTERVENTIONS.filter(i => i.status === 'active').length,
    completedInterventions: MOCK_INTERVENTIONS.filter(i => i.status === 'completed').length,
    averageImpact: MOCK_INTERVENTIONS.filter(i => i.impactPercentage)
      .reduce((acc, i) => acc + (i.impactPercentage || 0), 0) / 
      MOCK_INTERVENTIONS.filter(i => i.impactPercentage).length || 0,
    caseworkersTrained: new Set(MOCK_INTERVENTIONS.flatMap(i => i.targetedCaseworkers)).size,
    errorReductionAchieved: 3.7,
  };

  const filteredInterventions = selectedCategory === 'all' 
    ? MOCK_INTERVENTIONS 
    : MOCK_INTERVENTIONS.filter(i => i.errorCategory === selectedCategory);

  const handleCreateIntervention = () => {
    toast({
      title: "Training Intervention Created",
      description: `${newIntervention.name} has been scheduled.`,
    });
    setShowNewInterventionDialog(false);
    setNewIntervention({ name: '', description: '', errorCategory: '', startDate: '' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Completed</Badge>;
      case 'planned':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Planned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getImpactIndicator = (impact?: number) => {
    if (!impact) return null;
    
    if (impact >= 40) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingDown className="h-4 w-4" />
          <span className="font-semibold">{impact}% reduction</span>
        </div>
      );
    } else if (impact >= 20) {
      return (
        <div className="flex items-center gap-1 text-blue-600">
          <TrendingDown className="h-4 w-4" />
          <span className="font-semibold">{impact}% reduction</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <TrendingDown className="h-4 w-4" />
          <span className="font-semibold">{impact}% reduction</span>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Training Impact Tracing
          </h2>
          <p className="text-muted-foreground mt-1">
            Track PER reduction before and after targeted training interventions
          </p>
        </div>
        <Dialog open={showNewInterventionDialog} onOpenChange={setShowNewInterventionDialog}>
          <DialogTrigger asChild>
            <Button>
              <Play className="h-4 w-4 mr-2" />
              New Training Intervention
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Training Intervention</DialogTitle>
              <DialogDescription>
                Schedule a new targeted training to address specific error categories
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Intervention Name</Label>
                <Input 
                  id="name"
                  value={newIntervention.name}
                  onChange={(e) => setNewIntervention({...newIntervention, name: e.target.value})}
                  placeholder="e.g., Income Verification Refresher"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Target Error Category</Label>
                <Select 
                  value={newIntervention.errorCategory}
                  onValueChange={(value) => setNewIntervention({...newIntervention, errorCategory: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {ERROR_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input 
                  id="startDate"
                  type="date"
                  value={newIntervention.startDate}
                  onChange={(e) => setNewIntervention({...newIntervention, startDate: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description"
                  value={newIntervention.description}
                  onChange={(e) => setNewIntervention({...newIntervention, description: e.target.value})}
                  placeholder="Describe the training objectives and methodology..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewInterventionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateIntervention}>
                Create Intervention
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{metrics.totalInterventions}</p>
                <p className="text-xs text-muted-foreground">Total Interventions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{metrics.activeInterventions}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{metrics.completedInterventions}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{metrics.averageImpact.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Avg Impact</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{metrics.caseworkersTrained}</p>
                <p className="text-xs text-muted-foreground">Staff Trained</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">-{metrics.errorReductionAchieved}%</p>
                <p className="text-xs text-muted-foreground">PER Reduction</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Rate Trend with Training Markers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            PER Trend with Training Interventions
          </CardTitle>
          <CardDescription>
            Error rate changes before and after training interventions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_TREND_DATA}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis 
                  domain={[0, 12]} 
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Error Rate']}
                  labelFormatter={(label) => {
                    const point = MOCK_TREND_DATA.find(d => d.period === label);
                    return point?.trainingIntervention 
                      ? `${label} - Training: ${point.trainingIntervention}`
                      : label;
                  }}
                />
                <Legend />
                <ReferenceLine y={6} stroke="#f59e0b" strokeDasharray="5 5" label="Target: 6%" />
                <Line 
                  type="monotone" 
                  dataKey="errorRate" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (payload.trainingIntervention) {
                      return (
                        <g>
                          <circle cx={cx} cy={cy} r={8} fill="#22c55e" />
                          <circle cx={cx} cy={cy} r={4} fill="white" />
                        </g>
                      );
                    }
                    return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" />;
                  }}
                  name="Error Rate"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Training Intervention</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Regular Period</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 border-t-2 border-dashed border-yellow-500"></div>
              <span>Target Rate (6%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Training Interventions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Training Interventions</CardTitle>
              <CardDescription>Pre/post impact analysis for each intervention</CardDescription>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ERROR_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInterventions.map((intervention) => (
              <Card key={intervention.id} className="border">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{intervention.name}</h4>
                        {getStatusBadge(intervention.status)}
                        <Badge variant="outline">
                          {ERROR_CATEGORIES.find(c => c.value === intervention.errorCategory)?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {intervention.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {intervention.startDate}
                          {intervention.endDate && ` - ${intervention.endDate}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {intervention.targetedCaseworkers.length} caseworkers
                        </span>
                      </div>
                    </div>
                    
                    {/* Impact Visualization */}
                    <div className="flex items-center gap-6 ml-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Pre-Training</p>
                        <p className="text-xl font-bold text-red-600">
                          {intervention.preTrainingErrorRate}%
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Post-Training</p>
                        {intervention.postTrainingErrorRate !== undefined ? (
                          <p className="text-xl font-bold text-green-600">
                            {intervention.postTrainingErrorRate}%
                          </p>
                        ) : (
                          <p className="text-xl font-bold text-muted-foreground">--</p>
                        )}
                      </div>
                      <div className="text-center min-w-[80px]">
                        {intervention.impactPercentage !== undefined ? (
                          getImpactIndicator(intervention.impactPercentage)
                        ) : (
                          <Badge variant="outline">In Progress</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pre/Post Comparison Bar */}
                  {intervention.status === 'completed' && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20">Pre-Training:</span>
                        <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-400" 
                            style={{ width: `${intervention.preTrainingErrorRate * 8}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono w-12">{intervention.preTrainingErrorRate}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20">Post-Training:</span>
                        <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-400" 
                            style={{ width: `${(intervention.postTrainingErrorRate || 0) * 8}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono w-12">{intervention.postTrainingErrorRate}%</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Training Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Recommended Training Interventions
          </CardTitle>
          <CardDescription>
            AI-identified areas where training could reduce payment errors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/10">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">Resource Limit Verification</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    3 caseworkers showing elevated error rates (8.5%) in resource limit calculations. 
                    Recommended: 7 CFR 273.8 refresher training.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" variant="outline">
                      Schedule Training
                    </Button>
                    <Badge variant="secondary">High Priority</Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">Medical Expense Deduction</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    5 caseworkers could benefit from medical expense documentation training. 
                    Current error rate: 5.2% (above 4% target).
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" variant="outline">
                      Schedule Training
                    </Button>
                    <Badge variant="secondary">Medium Priority</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
