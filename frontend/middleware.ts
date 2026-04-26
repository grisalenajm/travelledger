import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/register|api/proxy|login|register|_next/static|_next/image|favicon\\.ico).*)",
  ],
}
