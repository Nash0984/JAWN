import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isClient: boolean;
  isNavigator: boolean;
  isCaseworker: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean; // Navigator or caseworker or admin
  login: () => void;
  logout: () => Promise<void>;
  refetch: () => void;
}

/**
 * Hook to access current user authentication state and role information
 */
export function useAuth(): AuthState {
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: user, isLoading, status } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn<{ user: User | null } | null>({ on401: "returnNull" }),
    select: (data: { user: User | null } | null) => {
      // Handle 401 response (null) or successful response with user data
      if (data === null) return null;
      return data.user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Invalidate auth query to trigger refetch and update state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  // Distinguish between "loading" (undefined) and "not authenticated" (null)
  const isAuthenticated = status === "success" && user !== null;
  const role = isAuthenticated ? user.role : null;

  return {
    user: user || null,
    isLoading,
    isAuthenticated,
    isClient: isAuthenticated && role === "client",
    isNavigator: isAuthenticated && role === "navigator",
    isCaseworker: isAuthenticated && role === "caseworker",
    isAdmin: isAuthenticated && role === "admin",
    isSuperAdmin: isAuthenticated && role === "super_admin",
    isStaff: isAuthenticated && (role === "navigator" || role === "caseworker" || role === "admin" || role === "super_admin"),
    login: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  };
}
