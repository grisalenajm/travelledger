import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    if (req.nextauth.token?.error === "RefreshAccessTokenError") {
      const url = new URL("/login", req.url)
      url.searchParams.set("error", "SessionExpired")
      return NextResponse.redirect(url)
    }
    // Redirige a /set-password si el usuario tiene un cambio de contraseña pendiente
    if (
      req.nextauth.token?.mustChangePassword &&
      !req.nextUrl.pathname.startsWith("/set-password")
    ) {
      return NextResponse.redirect(new URL("/set-password", req.url))
    }
    return NextResponse.next()
  },
  {
    pages: {
      signIn: "/login",
    },
  }
)

export const config = {
  matcher: [
    // Excluye: rutas API, login, register, invite (pública), set-password (auth propia), assets
    "/((?!api/auth|api/health|api/register|api/proxy|login|register|invite|setup|_next/static|_next/image|favicon\\.ico).*)",
  ],
}
