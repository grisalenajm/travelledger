import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    accessToken: string
    refreshToken: string
  }

  interface Session {
    accessToken: string
    error?: string
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    error?: string
  }
}
