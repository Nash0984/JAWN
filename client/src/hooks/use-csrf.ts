import { useQuery } from "@tanstack/react-query";

interface CsrfTokenResponse {
  token: string;
}

export function useCsrfToken() {
  const { data } = useQuery<CsrfTokenResponse>({
    queryKey: ['/api/csrf-token'],
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 60 minutes
  });

  return data?.token;
}
