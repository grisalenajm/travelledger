import type { DefaultSession } from "next-auth"

export type UserRole = "admin" | "user" | "guest"

declare module "next-auth" {
  interface User {
    accessToken: string
    refreshToken: string
    isGuest?: boolean
    role?: UserRole
    mustChangePassword?: boolean
  }

  interface Session {
    accessToken: string
    error?: string
    user: {
      id: string
      isGuest?: boolean
      role?: UserRole
      mustChangePassword?: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    isGuest?: boolean
    role?: UserRole
    mustChangePassword?: boolean
    error?: string
  }
}
