import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  fullName: z.string().optional(),
  role: z.enum(["client", "navigator", "caseworker", "admin"]).default("client"),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      fullName: "",
      role: "client",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      const response = await apiRequest("POST", "/api/auth/signup", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      // Determine dashboard URL based on user role
      const role = data.user.role;
      let dashboardUrl = "/";
      
      if (role === "admin" || role === "super_admin") {
        dashboardUrl = "/dashboard/admin";
      } else if (role === "navigator") {
        dashboardUrl = "/dashboard/navigator";
      } else if (role === "caseworker") {
        dashboardUrl = "/dashboard/caseworker";
      } else if (role === "client") {
        dashboardUrl = "/dashboard/client";
      }
      
      toast({
        title: "Account created!",
        description: `Welcome, ${data.user.username}! You're now logged in.`,
      });
      setLocation(dashboardUrl);
    },
    onError: (error: Error) => {
      toast({
        title: "Signup failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    signupMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-gray-50 px-4 py-8">
      <Card className="w-full max-w-md border-maryland-red/20" data-testid="card-signup">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4">
            <div className="h-12 flex items-center justify-center">
              <span className="text-3xl font-semibold text-maryland-red" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Maryland SNAP
              </span>
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold">Create an account</CardTitle>
          <CardDescription>
            Join the Maryland Benefits Navigator to access SNAP benefits information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Choose a username"
                        {...field}
                        data-testid="input-username"
                        disabled={signupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        {...field}
                        data-testid="input-fullname"
                        disabled={signupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your.email@example.com"
                        {...field}
                        data-testid="input-email"
                        disabled={signupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Choose a secure password"
                        {...field}
                        data-testid="input-password"
                        disabled={signupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="client" data-testid="option-client">
                          Client (SNAP Applicant)
                        </SelectItem>
                        <SelectItem value="navigator" data-testid="option-navigator">
                          Benefits Navigator
                        </SelectItem>
                        <SelectItem value="caseworker" data-testid="option-caseworker">
                          Caseworker
                        </SelectItem>
                        <SelectItem value="admin" data-testid="option-admin">
                          Administrator
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose "Client" if you're applying for benefits
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-maryland-red hover:bg-maryland-red/90"
                disabled={signupMutation.isPending}
                data-testid="button-signup"
              >
                {signupMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create account
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <button
              onClick={() => setLocation("/login")}
              className="text-maryland-red hover:underline font-medium"
              data-testid="link-login"
            >
              Log in
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
