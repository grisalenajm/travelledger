import { useQuery } from "@tanstack/react-query"

interface AuthStatus {
  registration_open: boolean
  has_users: boolean
}

export function useAuthStatus() {
  const { data, isLoading } = useQuery<AuthStatus>({
    queryKey: ["auth-status"],
    queryFn: async () => {
      const res = await fetch("/api/proxy/auth/status")
      if (!res.ok) throw new Error("Failed to fetch auth status")
      return res.json()
    },
    staleTime: 0,
  })

  return {
    registration_open: data?.registration_open ?? true,
    has_users: data?.has_users ?? false,
    isLoading,
  }
}
