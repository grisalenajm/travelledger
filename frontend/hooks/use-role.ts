"use client"
import { useSession } from "next-auth/react"

export type UserRole = "admin" | "user" | "guest"

export function useRole(): { role: UserRole; loading: boolean } {
  const { data: session, status } = useSession()
  return {
    role: (session?.user?.role as UserRole) ?? "user",
    loading: status === "loading",
  }
}

export function useIsAdmin(): boolean {
  const { role, loading } = useRole()
  if (loading) return false
  return role === "admin"
}

export function useIsGuest(): boolean {
  const { role, loading } = useRole()
  if (loading) return false
  return role === "guest"
}
