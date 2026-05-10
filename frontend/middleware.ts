import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    if (req.nextauth.token?.error === "RefreshAccessTokenError") {
      const url = new URL("/login", req.url)
      url.searchParams.set("error", "SessionExpired")
      return NextResponse.redirect(url)
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
    "/((?!api/auth|api/health|api/register|api/proxy|login|register|_next/static|_next/image|favicon\\.ico).*)",
  ],
}
