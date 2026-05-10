import { cookies } from "next/headers"
import type { AuthOptions } from "next-auth"
import type { JWT } from "next-auth/jwt"
import CredentialsProvider from "next-auth/providers/credentials"

const BACKEND_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"

const ACCESS_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 min — refleja ACCESS_TOKEN_EXPIRE_MINUTES del backend

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    // Try to read the HttpOnly refresh_token cookie from the current request context.
    // This works when called from within an App Router Route Handler (proxy or NextAuth routes),
    // which is the only context where the jwt callback can fire.
    let cookieHeader: string | undefined
    try {
      const cookieStore = cookies()
      const refreshCookie = cookieStore.get("refresh_token")?.value
      if (refreshCookie) {
        cookieHeader = `refresh_token=${refreshCookie}`
      }
    } catch {
      // cookies() not available in this context — fall back to JWT-embedded token only
    }

    const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      // Backend reads cookie-first; body is a fallback if cookie is absent
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    })
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)
    const data = (await res.json()) as { access_token: string; refresh_token: string }
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
      error: undefined,
    }
  } catch {
    return { ...token, error: "RefreshAccessTokenError" }
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Pre-fetched tokens passed from login/register pages after calling the proxy.
        // When present, authorize() skips the backend login call (avoids double login).
        accessToken: { label: "Access Token", type: "text" },
        refreshToken: { label: "Refresh Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null

        let accessToken: string
        let refreshToken: string

        if (credentials.accessToken && credentials.refreshToken) {
          // Tokens pre-fetched by the login/register page via /api/proxy/auth/login.
          // The browser already received the HttpOnly cookie at that point.
          // We only need to verify the token is valid.
          accessToken = credentials.accessToken
          refreshToken = credentials.refreshToken
        } else {
          // Fallback: standard flow (no pre-fetched tokens).
          // Browser will NOT receive the HttpOnly cookie this way.
          if (!credentials.email || !credentials.password) return null
          try {
            const tokenRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            })
            if (!tokenRes.ok) return null
            const tokens = (await tokenRes.json()) as {
              access_token: string
              refresh_token: string
            }
            accessToken = tokens.access_token
            refreshToken = tokens.refresh_token
          } catch {
            return null
          }
        }

        try {
          const userRes = await fetch(`${BACKEND_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (!userRes.ok) return null
          const user = (await userRes.json()) as {
            id: string
            email: string
            name: string
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            accessToken,
            refreshToken,
          }
        } catch {
          return null
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Login inicial — guarda tokens y calcula expiración
      if (user) {
        return {
          ...token,
          id: user.id,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
        }
      }
      // Token aún válido
      if (Date.now() < (token.accessTokenExpires ?? 0)) {
        return token
      }
      // Access token expirado — refresca usando cookie HttpOnly o token del JWT
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.user.id = token.id
      if (token.error) {
        session.error = token.error
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 días
  },
}
