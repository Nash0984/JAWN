import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CalendarIcon, Clock, User, MapPin, Plus, Loader2, X } from "lucide-react";
import { format, parse, addMinutes, isBefore, isAfter, startOfDay, endOfDay } from "date-fns";
import type { Appointment } from "@shared/schema";

const appointmentFormSchema = z.object({
  householdId: z.number({ required_error: "Please select a household" }),
  navigatorId: z.number({ required_error: "Please select a navigator" }),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  appointmentType: z.enum(["initial_intake", "follow_up", "tax_preparation", "document_review", "signature", "other"]),
  location: z.string().optional(),
  notes: z.string().optional(),
  syncWithGoogleCalendar: z.boolean().default(true),
}).refine((data) => {
  if (!data.startTime || !data.endTime) return true;
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return start < end;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine((data) => {
  if (!data.startTime) return true;
  const start = new Date(data.startTime);
  const now = new Date();
  return start >= now;
}, {
  message: "Appointment cannot be scheduled in the past",
  path: ["startTime"],
});

type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

export default function AppointmentsCalendar() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      syncWithGoogleCalendar: true,
    },
  });

  // Fetch appointments for selected date range
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", selectedDate?.toISOString()],
    enabled: !!selectedDate,
  });

  // Fetch households for dropdown
  const { data: households = [] } = useQuery<Array<{ id: number; primaryApplicantName: string }>>({
    queryKey: ["/api/households"],
  });

  // Fetch navigators for dropdown
  const { data: navigators = [] } = useQuery<Array<{ id: number; name: string; email: string }>>({
    queryKey: ["/api/users/navigators"],
  });

  // Create appointment mutation
  const createAppointment = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      return await apiRequest("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Appointment created",
        description: "The appointment has been successfully scheduled.",
      });
      setIsBookingDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to create appointment";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Cancel appointment mutation
  const cancelAppointment = useMutation({
    mutationFn: async (appointmentId: number) => {
      return await apiRequest(`/api/appointments/${appointmentId}/cancel`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Appointment cancelled",
        description: "The appointment has been successfully cancelled.",
      });
      setSelectedAppointment(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel appointment",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AppointmentFormData) => {
    createAppointment.mutate(data);
  };

  const handleBookAppointment = () => {
    if (selectedDate) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      form.setValue("startTime", `${dateStr}T09:00:00`);
      form.setValue("endTime", `${dateStr}T10:00:00`);
    }
    setIsBookingDialogOpen(true);
  };

  const handleCancelAppointment = (appointment: Appointment) => {
    if (confirm("Are you sure you want to cancel this appointment?")) {
      cancelAppointment.mutate(appointment.id);
    }
  };

  // Filter appointments for selected date
  const dayAppointments = selectedDate
    ? appointments.filter((apt) => {
        const aptDate = new Date(apt.startTime);
        return aptDate.toDateString() === selectedDate.toDateString();
      })
    : [];

  // Get dates with appointments for calendar highlighting
  const datesWithAppointments = appointments.map((apt) => new Date(apt.startTime));

  const getAppointmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      initial_intake: "Initial Intake",
      follow_up: "Follow-up",
      tax_preparation: "Tax Preparation",
      document_review: "Document Review",
      signature: "Signature",
      other: "Other",
    };
    return labels[type] || type;
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      completed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      no_show: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VITA Appointments Calendar</h1>
          <p className="text-muted-foreground mt-1">Schedule and manage VITA tax preparation appointments</p>
        </div>
        <Button onClick={handleBookAppointment} data-testid="button-book-appointment">
          <Plus className="w-4 h-4 mr-2" />
          Book Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
            <CardDescription>Select a date to view appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{
                hasAppointments: datesWithAppointments,
              }}
              modifiersStyles={{
                hasAppointments: {
                  fontWeight: "bold",
                  textDecoration: "underline",
                },
              }}
              className="rounded-md border"
              data-testid="calendar-appointment-selector"
            />
          </CardContent>
        </Card>

        {/* Appointments List Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, "MMMM dd, yyyy") : "Select a date"}
            </CardTitle>
            <CardDescription>
              {dayAppointments.length} appointment{dayAppointments.length !== 1 ? "s" : ""} scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAppointments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : dayAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No appointments scheduled for this date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dayAppointments
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .map((appointment) => (
                    <div
                      key={appointment.id}
                      className="border rounded-lg p-4 hover:border-primary transition-colors"
                      data-testid={`appointment-card-${appointment.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(appointment.status)}`}>
                              {appointment.status}
                            </span>
                            <span className="text-sm font-medium">{getAppointmentTypeLabel(appointment.appointmentType)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {format(new Date(appointment.startTime), "h:mm a")} - {format(new Date(appointment.endTime), "h:mm a")}
                            </div>
                            {appointment.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {appointment.location}
                              </div>
                            )}
                          </div>
                          {appointment.notes && (
                            <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                          )}
                        </div>
                        {appointment.status === "scheduled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelAppointment(appointment)}
                            aria-label="Cancel appointment"
                            data-testid={`button-cancel-${appointment.id}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Book Appointment Dialog */}
      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-book-appointment">
          <DialogHeader>
            <DialogTitle>Book New Appointment</DialogTitle>
            <DialogDescription>Schedule a new VITA appointment with a household</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="householdId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Household</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-household">
                            <SelectValue placeholder="Select household" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {households.map((household) => (
                            <SelectItem key={household.id} value={household.id.toString()} data-testid={`select-item-household-${household.id}`}>
                              {household.primaryApplicantName || `Household ${household.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="navigatorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Navigator</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-navigator">
                            <SelectValue placeholder="Select navigator" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {navigators.map((navigator) => (
                            <SelectItem key={navigator.id} value={navigator.id.toString()} data-testid={`select-item-navigator-${navigator.id}`}>
                              {navigator.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="appointmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appointment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-appointment-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="initial_intake" data-testid="select-item-type-initial-intake">Initial Intake</SelectItem>
                        <SelectItem value="follow_up" data-testid="select-item-type-follow-up">Follow-up</SelectItem>
                        <SelectItem value="tax_preparation" data-testid="select-item-type-tax-preparation">Tax Preparation</SelectItem>
                        <SelectItem value="document_review" data-testid="select-item-type-document-review">Document Review</SelectItem>
                        <SelectItem value="signature" data-testid="select-item-type-signature">Signature</SelectItem>
                        <SelectItem value="other" data-testid="select-item-type-other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-start-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-end-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Office 101, Virtual (Zoom), etc." {...field} data-testid="input-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes or special requirements..."
                        {...field}
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsBookingDialogOpen(false)} data-testid="button-cancel-dialog">
                  Cancel
                </Button>
                <Button type="submit" disabled={createAppointment.isPending} data-testid="button-submit-appointment">
                  {createAppointment.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Appointment"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
