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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
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
        title: "Welcome back!",
        description: `Logged in as ${data.user.username}`,
      });
      setLocation(dashboardUrl);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white to-gray-50 px-4">
      <Card className="w-full max-w-md border-maryland-red/20" data-testid="card-login">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4">
            <div className="h-12 flex items-center justify-center">
              <span className="text-3xl font-semibold text-maryland-red" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Maryland SNAP
              </span>
            </div>
          </div>
          <CardTitle className="text-2xl font-semibold">Log in to your account</CardTitle>
          <CardDescription>
            Enter your username and password to access the Maryland Benefits Navigator
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
                        placeholder="Enter your username"
                        {...field}
                        data-testid="input-username"
                        disabled={loginMutation.isPending}
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
                        placeholder="Enter your password"
                        {...field}
                        data-testid="input-password"
                        disabled={loginMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-maryland-red hover:bg-maryland-red/90"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Log in
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <button
              onClick={() => setLocation("/signup")}
              className="text-maryland-red hover:underline font-medium"
              data-testid="link-signup"
            >
              Sign up
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
