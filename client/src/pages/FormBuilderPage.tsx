import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Save, RefreshCw, X, GripVertical, FileText, Plus } from 'lucide-react';
import type { FormComponent } from '@shared/schema';

interface ComponentCardProps {
  component: FormComponent;
  isDragging?: boolean;
  isInCanvas?: boolean;
  onRemove?: () => void;
}

function ComponentCard({ component, isDragging = false, isInCanvas = false, onRemove }: ComponentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: component.id,
    disabled: !isInCanvas,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} data-testid={`component-card-${component.id}`}>
      <Card className={`mb-2 ${isDragging ? 'shadow-lg' : ''}`}>
        <CardHeader className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {isInCanvas && (
                <button
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing"
                  data-testid={`drag-handle-${component.id}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
              <div className="flex-1">
                <CardTitle className="text-sm">{component.componentName}</CardTitle>
                {component.description && (
                  <CardDescription className="text-xs mt-1">{component.description}</CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isInCanvas && component.usageCount !== undefined && (
                <Badge variant="secondary" className="text-xs" data-testid={`usage-count-${component.id}`}>
                  {component.usageCount} uses
                </Badge>
              )}
              {isInCanvas && onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  data-testid={`remove-component-${component.id}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

function DraggableComponent({ component }: { component: FormComponent }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: component.id,
  });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} data-testid={`draggable-component-${component.id}`}>
      <ComponentCard component={component} isDragging={isDragging} />
    </div>
  );
}

export default function FormBuilderPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [testContextData, setTestContextData] = useState<Record<string, any>>({
    recipientName: 'John Doe',
    householdSize: 3,
    monthlyIncome: 2500,
  });
  const [previewContent, setPreviewContent] = useState<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveFormData, setSaveFormData] = useState({
    templateCode: '',
    templateName: '',
    program: '',
    noticeType: 'custom',
    description: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch all components
  const { data: componentsGrouped = {}, isLoading: isLoadingComponents } = useQuery<Record<string, FormComponent[]>>({
    queryKey: ['/api/form-builder/components', selectedProgram],
    queryFn: async () => {
      const url = selectedProgram 
        ? `/api/form-builder/components?program=${selectedProgram}` 
        : '/api/form-builder/components';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch components');
      return response.json();
    },
  });

  // Preview mutation (debounced)
  const previewMutation = useMutation({
    mutationFn: async (data: { componentIds: string[]; contextData: Record<string, any> }) => {
      return apiRequest('/api/form-builder/preview', 'POST', data);
    },
    onSuccess: (data) => {
      setPreviewContent(data.generatedContent || '');
    },
    onError: (error: any) => {
      toast({
        title: 'Preview Error',
        description: error.message || 'Failed to generate preview',
        variant: 'destructive',
      });
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/form-builder/save-template', 'POST', data);
    },
    onSuccess: () => {
      toast({
        title: 'Template Saved',
        description: 'Your notification template has been saved successfully.',
      });
      setSaveDialogOpen(false);
      setSaveFormData({
        templateCode: '',
        templateName: '',
        program: '',
        noticeType: 'custom',
        description: '',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Save Error',
        description: error.message || 'Failed to save template',
        variant: 'destructive',
      });
    },
  });

  // Debounced preview update
  useEffect(() => {
    if (selectedComponents.length === 0) {
      setPreviewContent('');
      return;
    }

    const timer = setTimeout(() => {
      previewMutation.mutate({
        componentIds: selectedComponents,
        contextData: testContextData,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedComponents, testContextData]);

  // Get all components as flat array
  const allComponents = Object.values(componentsGrouped).flat();
  const selectedComponentsData = selectedComponents
    .map(id => allComponents.find(c => c.id === id))
    .filter(Boolean) as FormComponent[];

  // Filter components by search query
  const filteredComponentsGrouped = Object.entries(componentsGrouped).reduce((acc, [type, components]) => {
    const filtered = components.filter(c =>
      c.componentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[type] = filtered;
    }
    return acc;
  }, {} as Record<string, FormComponent[]>);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // If dragging from library to canvas
    if (!selectedComponents.includes(active.id as string)) {
      setSelectedComponents([...selectedComponents, active.id as string]);
      return;
    }

    // If reordering within canvas
    if (active.id !== over.id) {
      setSelectedComponents((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemoveComponent = (id: string) => {
    setSelectedComponents(selectedComponents.filter(cid => cid !== id));
  };

  const handleSaveTemplate = () => {
    if (selectedComponents.length === 0) {
      toast({
        title: 'No Components',
        description: 'Please add at least one component to the canvas.',
        variant: 'destructive',
      });
      return;
    }
    setSaveDialogOpen(true);
  };

  const handleSaveSubmit = () => {
    if (!saveFormData.templateCode || !saveFormData.templateName || !saveFormData.program) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    saveTemplateMutation.mutate({
      ...saveFormData,
      componentIds: selectedComponents,
      deliveryChannels: ['portal'],
    });
  };

  const handleRefreshPreview = () => {
    previewMutation.mutate({
      componentIds: selectedComponents,
      contextData: testContextData,
    });
  };

  const activeComponent = activeId ? allComponents.find(c => c.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col" data-testid="form-builder-page">
        {/* Header */}
        <div className="border-b bg-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">Form Builder</h1>
              <p className="text-sm text-muted-foreground">Create Official Notices</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger className="w-[180px]" data-testid="select-program">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Programs</SelectItem>
                  <SelectItem value="SNAP">SNAP</SelectItem>
                  <SelectItem value="MEDICAID">Medicaid</SelectItem>
                  <SelectItem value="TANF">TANF</SelectItem>
                  <SelectItem value="OHEP">OHEP</SelectItem>
                  <SelectItem value="VITA">VITA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Three-column layout */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Left Sidebar - Component Library */}
            <ResizablePanel defaultSize={25} minSize={20}>
              <div className="h-full flex flex-col p-4 overflow-hidden" data-testid="component-library">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-2">Component Library</h2>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search components..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                      data-testid="input-search-components"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4">
                  {isLoadingComponents ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : Object.keys(filteredComponentsGrouped).length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No components found</p>
                    </div>
                  ) : (
                    Object.entries(filteredComponentsGrouped).map(([type, components]) => (
                      <div key={type} data-testid={`component-group-${type}`}>
                        <h3 className="text-sm font-medium mb-2 capitalize">
                          {type} ({components.length})
                        </h3>
                        <SortableContext items={components.map(c => c.id)} strategy={verticalListSortingStrategy}>
                          {components.map((component) => (
                            <DraggableComponent key={component.id} component={component} />
                          ))}
                        </SortableContext>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Middle Panel - Form Canvas */}
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className="h-full flex flex-col p-4 overflow-hidden" data-testid="form-canvas">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Form Canvas</h2>
                  <p className="text-sm text-muted-foreground">Drag components here</p>
                </div>

                <div className="flex-1 overflow-y-auto border-2 border-dashed rounded-lg p-4 bg-muted/20">
                  {selectedComponents.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                      <div>
                        <Plus className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Drop components here to build your form</p>
                      </div>
                    </div>
                  ) : (
                    <SortableContext items={selectedComponents} strategy={verticalListSortingStrategy}>
                      {selectedComponentsData.map((component) => (
                        <ComponentCard
                          key={component.id}
                          component={component}
                          isInCanvas
                          onRemove={() => handleRemoveComponent(component.id)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={selectedComponents.length === 0 || saveTemplateMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-template"
                  >
                    {saveTemplateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save as Template
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Sidebar - Live Preview */}
            <ResizablePanel defaultSize={35} minSize={25}>
              <div className="h-full flex flex-col p-4 overflow-hidden" data-testid="preview-panel">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Preview</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshPreview}
                    disabled={previewMutation.isPending || selectedComponents.length === 0}
                    data-testid="button-refresh-preview"
                  >
                    <RefreshCw className={`h-4 w-4 ${previewMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {/* Test Data Input */}
                <div className="mb-4 space-y-2">
                  <Label className="text-sm font-medium">Test Context Data</Label>
                  <Textarea
                    value={JSON.stringify(testContextData, null, 2)}
                    onChange={(e) => {
                      try {
                        setTestContextData(JSON.parse(e.target.value));
                      } catch (err) {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="font-mono text-xs h-32"
                    data-testid="textarea-test-context"
                  />
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-card">
                  {previewMutation.isPending ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : previewContent ? (
                    <div className="prose prose-sm max-w-none" data-testid="preview-content">
                      <pre className="whitespace-pre-wrap text-sm">{previewContent}</pre>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                      <p>Preview will appear here</p>
                    </div>
                  )}
                </div>

                {/* Export to PDF (stub) */}
                <div className="mt-4">
                  <Button variant="outline" className="w-full" disabled data-testid="button-export-pdf">
                    <FileText className="mr-2 h-4 w-4" />
                    Export to PDF (Coming Soon)
                  </Button>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeComponent ? (
            <ComponentCard component={activeComponent} isDragging />
          ) : null}
        </DragOverlay>
      </div>

      {/* Save Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent data-testid="dialog-save-template">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Create a new notification template from the selected components.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="templateCode">Template Code *</Label>
              <Input
                id="templateCode"
                placeholder="e.g., SNAP_RECERTIFICATION"
                value={saveFormData.templateCode}
                onChange={(e) => setSaveFormData({ ...saveFormData, templateCode: e.target.value })}
                data-testid="input-template-code"
              />
            </div>

            <div>
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                placeholder="e.g., SNAP Recertification Notice"
                value={saveFormData.templateName}
                onChange={(e) => setSaveFormData({ ...saveFormData, templateName: e.target.value })}
                data-testid="input-template-name"
              />
            </div>

            <div>
              <Label htmlFor="program">Program *</Label>
              <Select
                value={saveFormData.program}
                onValueChange={(value) => setSaveFormData({ ...saveFormData, program: value })}
              >
                <SelectTrigger data-testid="select-save-program">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SNAP">SNAP</SelectItem>
                  <SelectItem value="MEDICAID">Medicaid</SelectItem>
                  <SelectItem value="TANF">TANF</SelectItem>
                  <SelectItem value="OHEP">OHEP</SelectItem>
                  <SelectItem value="VITA">VITA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this template is for..."
                value={saveFormData.description}
                onChange={(e) => setSaveFormData({ ...saveFormData, description: e.target.value })}
                data-testid="textarea-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} data-testid="button-cancel-save">
              Cancel
            </Button>
            <Button onClick={handleSaveSubmit} disabled={saveTemplateMutation.isPending} data-testid="button-confirm-save">
              {saveTemplateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
