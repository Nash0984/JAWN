import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// CSRF token cache
let csrfToken: string | null = null;

// Fetch CSRF token
async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  
  const res = await fetch('/api/csrf-token', {
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  
  const data = await res.json();
  csrfToken = data.token;
  return data.token;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  // Don't set Content-Type for FormData - browser will set it with boundary
  if (data && !(data instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add CSRF token for state-changing requests
  if (method !== "GET" && method !== "HEAD") {
    const token = await getCsrfToken();
    headers["x-csrf-token"] = token;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Helper for form uploads with CSRF
export async function apiUpload(
  url: string,
  formData: FormData,
): Promise<Response> {
  const token = await getCsrfToken();
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-csrf-token': token,
    },
    body: formData,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
