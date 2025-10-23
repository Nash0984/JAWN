import { useState } from "react";
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
import { Helmet } from "react-helmet-async";
import { useTenant } from "@/contexts/TenantContext";
import { TenantLogo } from "@/components/TenantLogo";
import { MFAVerification } from "@/components/MFAVerification";

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
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { stateConfig } = useTenant();
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [mfaUsername, setMfaUsername] = useState<string | null>(null);
  
  const stateName = stateConfig?.stateName || 'State';
  const agencyAcronym = stateConfig?.agencyAcronym || '';
  
  // Get returnUrl from query string
  const params = new URLSearchParams(window.location.search);
  const returnUrl = params.get('returnUrl');
  
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const navigateAfterLogin = (user: any) => {
    // If there's a returnUrl, navigate there; otherwise, determine dashboard URL based on role
    let destinationUrl = returnUrl || "/";
    
    if (!returnUrl) {
      const role = user.role;
      if (role === "admin" || role === "super_admin") {
        destinationUrl = "/dashboard/admin";
      } else if (role === "navigator") {
        destinationUrl = "/dashboard/navigator";
      } else if (role === "caseworker") {
        destinationUrl = "/dashboard/caseworker";
      } else if (role === "client") {
        destinationUrl = "/dashboard/client";
      }
    }
    
    // Show appropriate toast message
    if (returnUrl) {
      toast({
        title: "Welcome back!",
        description: "Your work has been restored.",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: `Logged in as ${user.username}`,
      });
    }
    
    setLocation(destinationUrl);
  };

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Check if MFA is required
      if (data.mfaRequired) {
        setMfaRequired(true);
        setMfaUserId(data.userId);
        setMfaUsername(data.username);
        return;
      }

      // No MFA required, proceed with normal login
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigateAfterLogin(data.user);
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't log you in",
        description: error.message || "Your username or password isn't correct. Please try again.",
        variant: "destructive",
      });
    },
  });

  const mfaLoginMutation = useMutation({
    mutationFn: async ({ token, useBackupCode }: { token: string; useBackupCode: boolean }) => {
      const response = await apiRequest("POST", "/api/auth/mfa-login", {
        userId: mfaUserId,
        token,
        useBackupCode,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      navigateAfterLogin(data.user);
    },
    onError: (error: Error) => {
      throw error; // Let MFAVerification component handle the error
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

  const handleMFAVerify = async (token: string, useBackupCode: boolean) => {
    await mfaLoginMutation.mutateAsync({ token, useBackupCode });
  };

  const handleMFACancel = () => {
    setMfaRequired(false);
    setMfaUserId(null);
    setMfaUsername(null);
    form.reset();
  };

  // Show MFA verification if required
  if (mfaRequired && mfaUserId && mfaUsername) {
    return (
      <>
        <Helmet>
          <title>Two-Factor Authentication - {stateName} Benefits Navigator</title>
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 px-4">
          <MFAVerification
            username={mfaUsername}
            userId={mfaUserId}
            onVerify={handleMFAVerify}
            onCancel={handleMFACancel}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Login - {stateName} Benefits Navigator</title>
        <meta name="description" content={`Access your ${stateName} benefits account and manage your applications`} />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 px-4">
      <Card className="w-full max-w-md card-elevated" data-testid="card-login">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <TenantLogo variant="primary" className="h-16 w-16" />
          </div>
          <CardTitle className="text-2xl font-semibold">Log in to your account</CardTitle>
          <CardDescription>
            Enter your username and password to access the {stateName} Benefits Navigator
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
                        className="input-modern"
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
                        className="input-modern"
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
                className="w-full bg-brand-primary hover:bg-brand-primary/90"
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
              className="text-brand-primary hover:underline font-medium"
              data-testid="link-signup"
            >
              Sign up
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
