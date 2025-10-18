import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AdminConsole() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectedLocaleId, setSelectedLocaleId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"translator" | "reviewer">("translator");

  // Fetch assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['/api/translations/assignments'],
  });

  // Fetch locales
  const { data: locales } = useQuery({
    queryKey: ['/api/locales'],
  });

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: { keyId: string; targetLocaleId: string; userId: string; role: string }) => {
      return apiRequest('POST', '/api/translations/assignments', { body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/translations/assignments'] });
      toast({ title: "Success", description: "Assignment created successfully" });
      setCreateDialogOpen(false);
      setSelectedKeyId("");
      setSelectedLocaleId("");
      setSelectedUserId("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create assignment", variant: "destructive" });
    },
  });

  // Export translations mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLocaleId) throw new Error("Please select a locale");
      const result = await apiRequest('POST', '/api/translations/export', {
        body: { targetLocaleId: selectedLocaleId },
      });
      // Download as JSON file
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translations-${selectedLocaleId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return result;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Translations exported successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to export", variant: "destructive" });
    },
  });

  const handleCreateAssignment = () => {
    if (!selectedKeyId || !selectedLocaleId || !selectedUserId || !selectedRole) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }
    createAssignmentMutation.mutate({
      keyId: selectedKeyId,
      targetLocaleId: selectedLocaleId,
      userId: selectedUserId,
      role: selectedRole,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Translation Assignments</CardTitle>
            <div className="flex gap-2">
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-assignment">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Assignment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Assignment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Translation Key ID</label>
                      <input
                        type="text"
                        value={selectedKeyId}
                        onChange={(e) => setSelectedKeyId(e.target.value)}
                        placeholder="Enter key ID..."
                        className="w-full px-3 py-2 border rounded-md"
                        data-testid="input-key-id"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Target Locale</label>
                      <Select value={selectedLocaleId} onValueChange={setSelectedLocaleId}>
                        <SelectTrigger data-testid="select-target-locale">
                          <SelectValue placeholder="Select locale" />
                        </SelectTrigger>
                        <SelectContent>
                          {locales?.map((locale: any) => (
                            <SelectItem key={locale.id} value={locale.id}>
                              {locale.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">User ID</label>
                      <input
                        type="text"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        placeholder="Enter user ID..."
                        className="w-full px-3 py-2 border rounded-md"
                        data-testid="input-user-id"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Role</label>
                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="translator">Translator</SelectItem>
                          <SelectItem value="reviewer">Reviewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCreateAssignment}
                      disabled={createAssignmentMutation.isPending}
                      className="w-full"
                      data-testid="button-submit-assignment"
                    >
                      Create Assignment
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Select value={selectedLocaleId} onValueChange={setSelectedLocaleId}>
                <SelectTrigger className="w-[200px]" data-testid="select-export-locale">
                  <SelectValue placeholder="Select locale to export" />
                </SelectTrigger>
                <SelectContent>
                  {locales?.map((locale: any) => (
                    <SelectItem key={locale.id} value={locale.id}>
                      {locale.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || !selectedLocaleId}
                data-testid="button-export"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading assignments...</p>
          ) : assignments && assignments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Locale</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment: any) => (
                  <TableRow key={assignment.id} data-testid={`row-assignment-${assignment.id}`}>
                    <TableCell className="font-mono text-sm">{assignment.key?.key || assignment.keyId}</TableCell>
                    <TableCell>{assignment.targetLocale?.name || assignment.targetLocaleId}</TableCell>
                    <TableCell>{assignment.user?.fullName || assignment.userId}</TableCell>
                    <TableCell>
                      <Badge variant={assignment.role === 'translator' ? 'default' : 'secondary'}>
                        {assignment.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.status === 'active' ? 'default' : 'outline'}>
                        {assignment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(assignment.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No assignments yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
