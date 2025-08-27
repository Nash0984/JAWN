import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, OctagonMinus, Archive, TrendingUp, Activity } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TrainingJob {
  id: string;
  modelVersionId: string;
  status: string;
  progress: number;
  config: any;
  metrics: any;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface ModelVersion {
  id: string;
  name: string;
  version: string;
  modelType: string;
  status: string;
  config: any;
  performance: any;
  createdAt: string;
  deployedAt?: string;
}

export default function ModelTraining() {
  const [selectedModelType, setSelectedModelType] = useState("classification");
  const { toast } = useToast();

  const { data: trainingJobs = [] } = useQuery({
    queryKey: ["/api/training-jobs"],
    refetchInterval: 5000, // Poll every 5 seconds for active jobs
  });

  const { data: modelVersions = [] } = useQuery({
    queryKey: ["/api/models"],
  });

  const startTrainingMutation = useMutation({
    mutationFn: async (config: any) => {
      const response = await apiRequest("POST", "/api/training-jobs", config);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-jobs"] });
      toast({
        title: "Training Started",
        description: "Model training has been initiated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Training Failed",
        description: "Failed to start model training.",
        variant: "destructive",
      });
      console.error("Training start error:", error);
    },
  });

  const updateTrainingMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/training-jobs/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-jobs"] });
    },
  });

  const handleStartTraining = () => {
    const config = {
      modelVersionId: null, // Will create new version
      status: "queued",
      config: {
        modelType: selectedModelType,
        epochs: 10,
        batchSize: 32,
        learningRate: 0.001,
        datasetSize: 15847,
      },
    };
    startTrainingMutation.mutate(config);
  };

  const handlePauseTraining = (jobId: string) => {
    updateTrainingMutation.mutate({ id: jobId, status: "paused" });
  };

  const handleStopTraining = (jobId: string) => {
    updateTrainingMutation.mutate({ id: jobId, status: "stopped" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "training":
      case "running":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "production":
        return "bg-green-100 text-green-800";
      case "staging":
        return "bg-blue-100 text-blue-800";
      case "archived":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const activeTrainingJobs = trainingJobs.filter((job: TrainingJob) => 
    ["queued", "running", "training"].includes(job.status)
  );

  const currentTrainingJob = activeTrainingJobs[0];

  // Mock performance metrics for display
  const mockPerformanceMetrics = {
    documentClassification: {
      accuracy: 96.4,
      f1Score: 94.1,
    },
    ragRetrieval: {
      relevanceAt5: 91.2,
      ndcgAt10: 0.847,
    },
    ocrQuality: {
      characterAccuracy: 97.8,
      wordAccuracy: 94.3,
    }
  };

  const mockModelVersions = [
    { version: "v2.1.3", status: "production", active: true },
    { version: "v2.1.2", status: "staging", active: false },
    { version: "v2.0.9", status: "archived", active: false },
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="training" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="training" data-testid="tab-training">Training</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="models" data-testid="tab-models">Models</TabsTrigger>
        </TabsList>

        <TabsContent value="training" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Training Pipeline */}
            <Card className="shadow-lg border border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Model Training
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Training Job */}
                {currentTrainingJob ? (
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-medium text-foreground">Document Classification Model</h5>
                      <Badge className="bg-blue-100 text-blue-800">
                        {currentTrainingJob.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress:</span>
                        <span className="text-foreground font-medium">
                          Epoch {Math.floor((currentTrainingJob.progress || 0) * 10)}/10 ({Math.round((currentTrainingJob.progress || 0) * 100)}%)
                        </span>
                      </div>
                      <Progress 
                        value={(currentTrainingJob.progress || 0) * 100} 
                        className="h-2"
                        data-testid="training-progress"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Started: {currentTrainingJob.startedAt 
                            ? new Date(currentTrainingJob.startedAt).toLocaleString()
                            : "Just now"
                          }
                        </span>
                        <span>ETA: {Math.round((1 - (currentTrainingJob.progress || 0)) * 60)} minutes</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <Play className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No active training jobs</p>
                  </div>
                )}

                {/* Training Dataset Info */}
                <div className="bg-muted rounded-lg p-4">
                  <h5 className="font-medium text-foreground mb-3">Training Dataset</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Documents:</span>
                      <span className="text-foreground font-medium">15,847</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Labeled Examples:</span>
                      <span className="text-foreground font-medium">8,923</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Training Split:</span>
                      <span className="text-foreground font-medium">70% / 20% / 10%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated:</span>
                      <span className="text-foreground font-medium">3 days ago</span>
                    </div>
                  </div>
                </div>

                {/* Training Controls */}
                <div className="flex space-x-3">
                  <Button 
                    onClick={handleStartTraining}
                    disabled={!!currentTrainingJob || startTrainingMutation.isPending}
                    data-testid="button-start-training"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Training
                  </Button>
                  {currentTrainingJob && (
                    <>
                      <Button 
                        variant="secondary"
                        onClick={() => handlePauseTraining(currentTrainingJob.id)}
                        data-testid="button-pause-training"
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleStopTraining(currentTrainingJob.id)}
                        data-testid="button-stop-training"
                      >
                        <OctagonMinus className="mr-2 h-4 w-4" />
                        OctagonMinus
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Training History */}
            <Card className="shadow-lg border border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Training History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trainingJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No training jobs yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trainingJobs.slice(0, 5).map((job: TrainingJob) => (
                      <div 
                        key={job.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        data-testid={`training-job-${job.id}`}
                      >
                        <div>
                          <div className="font-medium text-foreground">
                            {job.config?.modelType || "Classification"} Model
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(job.createdAt).toLocaleDateString()}
                            {job.completedAt && ` • Completed: ${new Date(job.completedAt).toLocaleDateString()}`}
                          </div>
                        </div>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Document Classification Performance */}
            <Card className="shadow-lg border border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Document Classification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600" data-testid="metric-classification-accuracy">
                      {mockPerformanceMetrics.documentClassification.accuracy}%
                    </div>
                    <div className="text-sm text-muted-foreground">Accuracy</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600" data-testid="metric-classification-f1">
                      {mockPerformanceMetrics.documentClassification.f1Score}%
                    </div>
                    <div className="text-sm text-muted-foreground">F1 Score</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* RAG Retrieval Performance */}
            <Card className="shadow-lg border border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground flex items-center">
                  <Activity className="mr-2 h-5 w-5" />
                  RAG Retrieval
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600" data-testid="metric-rag-relevance">
                      {mockPerformanceMetrics.ragRetrieval.relevanceAt5}%
                    </div>
                    <div className="text-sm text-muted-foreground">Relevance@5</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600" data-testid="metric-rag-ndcg">
                      {mockPerformanceMetrics.ragRetrieval.ndcgAt10}
                    </div>
                    <div className="text-sm text-muted-foreground">NDCG@10</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* OCR Quality Performance */}
            <Card className="shadow-lg border border-border">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground flex items-center">
                  <Archive className="mr-2 h-5 w-5" />
                  OCR Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600" data-testid="metric-ocr-character">
                      {mockPerformanceMetrics.ocrQuality.characterAccuracy}%
                    </div>
                    <div className="text-sm text-muted-foreground">Character Accuracy</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600" data-testid="metric-ocr-word">
                      {mockPerformanceMetrics.ocrQuality.wordAccuracy}%
                    </div>
                    <div className="text-sm text-muted-foreground">Word Accuracy</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card className="shadow-lg border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">
                Model Versions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockModelVersions.map((model, index) => (
                  <div 
                    key={model.version}
                    className={`flex items-center justify-between p-3 rounded border ${
                      model.active 
                        ? "bg-green-50 border-green-200" 
                        : "bg-muted border-border"
                    }`}
                    data-testid={`model-version-${model.version}`}
                  >
                    <span className={`text-sm font-medium ${
                      model.active ? "text-green-800" : "text-muted-foreground"
                    }`}>
                      {model.version} {model.active && "(Production)"}
                    </span>
                    <Badge className={getStatusColor(model.status)}>
                      {model.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
