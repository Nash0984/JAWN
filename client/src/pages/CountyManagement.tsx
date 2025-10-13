import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, MapPin, Plus, Edit, Trash2, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface County {
  id: string;
  name: string;
  code: string;
  countyType: string;
  region: string;
  population: number;
  brandingConfig: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    headerText?: string;
  };
  contactInfo: {
    phone?: string;
    email?: string;
    address?: string;
    hours?: string;
  };
  isActive: boolean;
  isPilot: boolean;
}

interface User {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
}

interface CountyUser {
  id: string;
  countyId: string;
  userId: string;
  role: string;
  isPrimary: boolean;
  user: User;
}

// County form schema
const countyFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  countyType: z.string().min(1, "County type is required"),
  region: z.string().min(1, "Region is required"),
  population: z.coerce.number().min(0, "Population must be a positive number"),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  headerText: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  hours: z.string().optional(),
  isActive: z.boolean(),
  isPilot: z.boolean(),
});

type CountyFormValues = z.infer<typeof countyFormSchema>;

// User assignment schema
const userAssignmentSchema = z.object({
  userId: z.string().min(1, "User is required"),
  role: z.string().min(1, "Role is required"),
});

type UserAssignmentValues = z.infer<typeof userAssignmentSchema>;

export default function CountyManagement() {
  const { toast } = useToast();
  const [selectedCounty, setSelectedCounty] = useState<County | null>(null);
  const [showCountyDialog, setShowCountyDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Fetch counties
  const { data: counties, isLoading: countiesLoading } = useQuery<County[]>({
    queryKey: ['/api/counties'],
  });

  // Fetch users
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Fetch county users when a county is selected
  const { data: countyUsers, isLoading: countyUsersLoading } = useQuery<CountyUser[]>({
    queryKey: ['/api/counties', selectedCounty?.id, 'users'],
    enabled: !!selectedCounty,
  });

  // County form
  const countyForm = useForm<CountyFormValues>({
    resolver: zodResolver(countyFormSchema),
    defaultValues: {
      name: "",
      code: "",
      countyType: "ldss",
      region: "central",
      population: 0,
      primaryColor: "#000000",
      secondaryColor: "#000000",
      headerText: "",
      phone: "",
      email: "",
      address: "",
      hours: "",
      isActive: true,
      isPilot: false,
    },
  });

  // User assignment form
  const userForm = useForm<UserAssignmentValues>({
    resolver: zodResolver(userAssignmentSchema),
    defaultValues: {
      userId: "",
      role: "navigator",
    },
  });

  // Update county form when edit mode changes
  useEffect(() => {
    if (editMode && selectedCounty) {
      countyForm.reset({
        name: selectedCounty.name,
        code: selectedCounty.code,
        countyType: selectedCounty.countyType,
        region: selectedCounty.region,
        population: selectedCounty.population,
        primaryColor: selectedCounty.brandingConfig?.primaryColor || "#000000",
        secondaryColor: selectedCounty.brandingConfig?.secondaryColor || "#000000",
        headerText: selectedCounty.brandingConfig?.headerText || "",
        phone: selectedCounty.contactInfo?.phone || "",
        email: selectedCounty.contactInfo?.email || "",
        address: selectedCounty.contactInfo?.address || "",
        hours: selectedCounty.contactInfo?.hours || "",
        isActive: selectedCounty.isActive,
        isPilot: selectedCounty.isPilot,
      });
    } else {
      countyForm.reset({
        name: "",
        code: "",
        countyType: "ldss",
        region: "central",
        population: 0,
        primaryColor: "#000000",
        secondaryColor: "#000000",
        headerText: "",
        phone: "",
        email: "",
        address: "",
        hours: "",
        isActive: true,
        isPilot: false,
      });
    }
  }, [editMode, selectedCounty, countyForm]);

  // Reset user form when dialog opens
  useEffect(() => {
    if (showUserDialog) {
      userForm.reset({
        userId: "",
        role: "navigator",
      });
    }
  }, [showUserDialog, userForm]);

  // Create county mutation
  const createCountyMutation = useMutation({
    mutationFn: async (countyData: Partial<County>) => {
      const res = await apiRequest('POST', '/api/counties', countyData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/counties'] });
      setShowCountyDialog(false);
      toast({
        title: "County created",
        description: "The county has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create county. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update county mutation
  const updateCountyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<County> }) => {
      const res = await apiRequest('PATCH', `/api/counties/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/counties'] });
      setShowCountyDialog(false);
      setEditMode(false);
      toast({
        title: "County updated",
        description: "The county has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update county. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Assign user to county mutation
  const assignUserMutation = useMutation({
    mutationFn: async ({ countyId, userId, role }: { countyId: string; userId: string; role: string }) => {
      const res = await apiRequest('POST', `/api/counties/${countyId}/users`, { userId, role });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/counties', selectedCounty?.id, 'users'] });
      setShowUserDialog(false);
      toast({
        title: "User assigned",
        description: "The user has been assigned to the county successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign user. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove user from county mutation
  const removeUserMutation = useMutation({
    mutationFn: async (countyUserId: string) => {
      const res = await apiRequest('DELETE', `/api/county-users/${countyUserId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/counties', selectedCounty?.id, 'users'] });
      toast({
        title: "User removed",
        description: "The user has been removed from the county.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmitCounty = (values: CountyFormValues) => {
    const countyData = {
      name: values.name,
      code: values.code,
      countyType: values.countyType,
      region: values.region,
      population: values.population,
      brandingConfig: {
        primaryColor: values.primaryColor,
        secondaryColor: values.secondaryColor,
        headerText: values.headerText,
      },
      contactInfo: {
        phone: values.phone,
        email: values.email,
        address: values.address,
        hours: values.hours,
      },
      isActive: values.isActive,
      isPilot: values.isPilot,
    };

    if (editMode && selectedCounty) {
      updateCountyMutation.mutate({ id: selectedCounty.id, data: countyData });
    } else {
      createCountyMutation.mutate(countyData);
    }
  };

  const onSubmitUserAssignment = (values: UserAssignmentValues) => {
    if (selectedCounty) {
      assignUserMutation.mutate({
        countyId: selectedCounty.id,
        userId: values.userId,
        role: values.role,
      });
    }
  };

  if (countiesLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">County Management</h1>
          <p className="text-muted-foreground">Manage counties, assign staff, and configure branding</p>
        </div>
        <Button onClick={() => { setEditMode(false); setShowCountyDialog(true); }} data-testid="button-create-county">
          <Plus className="h-4 w-4 mr-2" />
          Add County
        </Button>
      </div>

      <Tabs defaultValue="counties" className="space-y-4">
        <TabsList>
          <TabsTrigger value="counties" data-testid="tab-counties">Counties</TabsTrigger>
          <TabsTrigger value="details" disabled={!selectedCounty} data-testid="tab-details">County Details</TabsTrigger>
        </TabsList>

        <TabsContent value="counties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Counties</CardTitle>
              <CardDescription>View and manage all LDSS counties</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Population</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pilot</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counties?.map((county) => (
                    <TableRow key={county.id} data-testid={`row-county-${county.id}`}>
                      <TableCell className="font-medium">{county.name}</TableCell>
                      <TableCell>{county.code}</TableCell>
                      <TableCell className="capitalize">{county.region}</TableCell>
                      <TableCell>{county.population.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={county.isActive ? "default" : "secondary"} data-testid={`badge-status-${county.id}`}>
                          {county.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {county.isPilot && <Badge variant="outline" data-testid={`badge-pilot-${county.id}`}>Pilot</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedCounty(county)}
                            data-testid={`button-view-${county.id}`}
                          >
                            View
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedCounty(county);
                              setEditMode(true);
                              setShowCountyDialog(true);
                            }}
                            data-testid={`button-edit-${county.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {selectedCounty && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">County Info</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedCounty.name}</div>
                    <p className="text-xs text-muted-foreground">Code: {selectedCounty.code}</p>
                    <p className="text-xs text-muted-foreground">Region: {selectedCounty.region}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Population</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedCounty.population.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Residents</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Assigned Staff</CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{countyUsers?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Active users</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Assigned Staff</CardTitle>
                      <CardDescription>Users assigned to {selectedCounty.name}</CardDescription>
                    </div>
                    <Button onClick={() => setShowUserDialog(true)} size="sm" data-testid="button-assign-user">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign User
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {countyUsersLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Primary</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {countyUsers?.map((cu) => (
                          <TableRow key={cu.id} data-testid={`row-user-${cu.id}`}>
                            <TableCell>{cu.user.fullName || '-'}</TableCell>
                            <TableCell>{cu.user.username}</TableCell>
                            <TableCell className="capitalize">{cu.role}</TableCell>
                            <TableCell>{cu.isPrimary && <Badge>Primary</Badge>}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeUserMutation.mutate(cu.id)}
                                data-testid={`button-remove-${cu.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Branding Configuration</CardTitle>
                  <CardDescription>Visual identity and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Primary Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div 
                          className="w-8 h-8 rounded border" 
                          style={{ backgroundColor: selectedCounty.brandingConfig?.primaryColor || '#000' }}
                        />
                        <span className="text-sm">{selectedCounty.brandingConfig?.primaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <Label>Secondary Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div 
                          className="w-8 h-8 rounded border" 
                          style={{ backgroundColor: selectedCounty.brandingConfig?.secondaryColor || '#000' }}
                        />
                        <span className="text-sm">{selectedCounty.brandingConfig?.secondaryColor}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Header Text</Label>
                    <p className="text-sm mt-1">{selectedCounty.brandingConfig?.headerText}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Phone</Label>
                      <p className="text-sm mt-1">{selectedCounty.contactInfo?.phone || 'Not set'}</p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="text-sm mt-1">{selectedCounty.contactInfo?.email || 'Not set'}</p>
                    </div>
                    <div className="col-span-2">
                      <Label>Address</Label>
                      <p className="text-sm mt-1">{selectedCounty.contactInfo?.address || 'Not set'}</p>
                    </div>
                    <div className="col-span-2">
                      <Label>Hours</Label>
                      <p className="text-sm mt-1">{selectedCounty.contactInfo?.hours || 'Not set'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* County Create/Edit Dialog */}
      <Dialog open={showCountyDialog} onOpenChange={setShowCountyDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit County' : 'Create County'}</DialogTitle>
            <DialogDescription>
              {editMode ? 'Update county information and configuration' : 'Add a new county to the system'}
            </DialogDescription>
          </DialogHeader>
          <Form {...countyForm}>
            <form onSubmit={countyForm.handleSubmit(onSubmitCounty)}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={countyForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County Name</FormLabel>
                        <FormControl>
                          <Input data-testid="input-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={countyForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County Code</FormLabel>
                        <FormControl>
                          <Input data-testid="input-code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={countyForm.control}
                    name="countyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ldss" data-testid="select-item-ldss">LDSS</SelectItem>
                            <SelectItem value="county" data-testid="select-item-county">County</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={countyForm.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-region">
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="central" data-testid="select-item-central">Central</SelectItem>
                            <SelectItem value="eastern" data-testid="select-item-eastern">Eastern</SelectItem>
                            <SelectItem value="western" data-testid="select-item-western">Western</SelectItem>
                            <SelectItem value="southern" data-testid="select-item-southern">Southern</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={countyForm.control}
                  name="population"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Population</FormLabel>
                      <FormControl>
                        <Input type="number" data-testid="input-population" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={countyForm.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Color</FormLabel>
                        <FormControl>
                          <Input type="color" data-testid="input-primary-color" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={countyForm.control}
                    name="secondaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Color</FormLabel>
                        <FormControl>
                          <Input type="color" data-testid="input-secondary-color" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={countyForm.control}
                  name="headerText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Header Text</FormLabel>
                      <FormControl>
                        <Input data-testid="input-header-text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={countyForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input data-testid="input-phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={countyForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" data-testid="input-email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={countyForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input data-testid="input-address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={countyForm.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours</FormLabel>
                      <FormControl>
                        <Input data-testid="input-hours" placeholder="e.g., Monday-Friday 8:00 AM - 5:00 PM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={countyForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Active</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === 'true')} value={String(field.value)}>
                          <FormControl>
                            <SelectTrigger data-testid="select-active">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true" data-testid="select-item-active">Active</SelectItem>
                            <SelectItem value="false" data-testid="select-item-inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={countyForm.control}
                    name="isPilot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pilot County</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === 'true')} value={String(field.value)}>
                          <FormControl>
                            <SelectTrigger data-testid="select-pilot">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true" data-testid="select-item-pilot-yes">Yes</SelectItem>
                            <SelectItem value="false" data-testid="select-item-pilot-no">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCountyDialog(false)} data-testid="button-cancel-county">
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-county">
                  {editMode ? 'Update' : 'Create'} County
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to County</DialogTitle>
            <DialogDescription>
              Assign a user to {selectedCounty?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(onSubmitUserAssignment)}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={userForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user">
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {usersLoading ? (
                            <SelectItem value="loading" disabled data-testid="select-item-loading">Loading...</SelectItem>
                          ) : (
                            users?.filter(u => u.role !== 'client').map(user => (
                              <SelectItem key={user.id} value={user.id} data-testid={`select-item-user-${user.id}`}>
                                {user.fullName || user.username} ({user.role})
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={userForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-role">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="navigator" data-testid="select-item-navigator">Navigator</SelectItem>
                          <SelectItem value="caseworker" data-testid="select-item-caseworker">Caseworker</SelectItem>
                          <SelectItem value="admin" data-testid="select-item-admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)} data-testid="button-cancel-user">
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-user">
                  Assign User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
