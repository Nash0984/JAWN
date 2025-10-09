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
import { Loader2, UserCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const loginSchema = z.object({
  username: z.string().min(3, "Your username needs to be at least 3 characters"),
  password: z.string().min(6, "Your password needs to be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const demoAccounts = [
  {
    username: "demo.applicant",
    password: "Demo2024!",
    role: "Applicant",
    description: "Test the applicant experience",
  },
  {
    username: "demo.navigator",
    password: "Demo2024!",
    role: "Navigator",
    description: "Benefits navigator tools",
  },
  {
    username: "demo.caseworker",
    password: "Demo2024!",
    role: "Caseworker",
    description: "Case management features",
  },
  {
    username: "demo.admin",
    password: "Demo2024!",
    role: "Admin",
    description: "Full system administration",
  },
];

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
        title: "Couldn't log you in",
        description: error.message || "Your username or password isn't correct. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const useDemoAccount = (username: string, password: string) => {
    form.setValue("username", username);
    form.setValue("password", password);
    loginMutation.mutate({ username, password });
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

          <Collapsible className="mt-6">
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                data-testid="button-toggle-demo"
              >
                <UserCircle className="mr-2 h-4 w-4" />
                Use Demo Account
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Quick login for testing different roles:
              </p>
              {demoAccounts.map((account) => (
                <Button
                  key={account.username}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => useDemoAccount(account.username, account.password)}
                  disabled={loginMutation.isPending}
                  data-testid={`button-demo-${account.role.toLowerCase()}`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">{account.role}</span>
                    <span className="text-xs text-muted-foreground">{account.description}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {account.username}
                    </span>
                  </div>
                </Button>
              ))}
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                All demo accounts use password: <code className="bg-muted px-1 py-0.5 rounded">Demo2024!</code>
              </p>
            </CollapsibleContent>
          </Collapsible>

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
