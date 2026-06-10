import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://backend:8000"

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, "GET")
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, "POST")
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, "PUT")
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, "DELETE")
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path, "PATCH")
}

async function proxy(req: NextRequest, pathSegments: string[], method: string) {
  const session = await getServerSession(authOptions)
  const joinedPath = pathSegments.join("/")
  const searchParams = req.nextUrl.searchParams.toString()
  const url = `${API_INTERNAL_URL}/api/${joinedPath}${searchParams ? `?${searchParams}` : ""}`

  const incomingContentType = req.headers.get("content-type") ?? ""
  const isMultipart = incomingContentType.startsWith("multipart/form-data")

  const fetchHeaders: Record<string, string> = {}
  if (session?.accessToken) {
    fetchHeaders["Authorization"] = `Bearer ${session.accessToken}`
  }
  // Multipart: forward content-type as-is (includes boundary); JSON: force application/json
  if (isMultipart) {
    fetchHeaders["Content-Type"] = incomingContentType
  } else {
    fetchHeaders["Content-Type"] = "application/json"
  }
  // Forward browser cookies so the backend can read the HttpOnly refresh_token cookie
  const cookieHeader = req.headers.get("cookie")
  if (cookieHeader) {
    fetchHeaders["Cookie"] = cookieHeader
  }
  // Forward the real client IP (set by nginx-proxy-manager) so backend rate
  // limiting and security logs are per-client instead of per-proxy
  const forwardedFor = req.headers.get("x-forwarded-for") ?? req.ip
  if (forwardedFor) {
    fetchHeaders["X-Forwarded-For"] = forwardedFor
  }

  const hasBody = ["POST", "PUT", "PATCH"].includes(method)
  let body: BodyInit | undefined
  if (hasBody) {
    body = isMultipart ? await req.arrayBuffer() : await req.text()
  }

  const response = await fetch(url, {
    method,
    headers: fetchHeaders,
    body,
    redirect: "follow",
    // @ts-ignore
    duplex: "half",
  })

  if (response.status === 204) {
    // Propagate Set-Cookie even on 204 (e.g. logout clears the refresh_token cookie)
    const emptyCookies: string[] =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : response.headers.get("set-cookie")
          ? [response.headers.get("set-cookie")!]
          : []
    if (emptyCookies.length === 0) return new NextResponse(null, { status: 204 })
    const h204 = new Headers()
    emptyCookies.forEach((c) => h204.append("set-cookie", c))
    return new NextResponse(null, { status: 204, headers: h204 })
  }

  const responseBody = await response.arrayBuffer()
  const contentType = response.headers.get("content-type") ?? "application/json"
  const contentDisposition = response.headers.get("content-disposition")
  const responseHeaders = new Headers()
  responseHeaders.set("Content-Type", contentType)
  if (contentDisposition) {
    responseHeaders.set("Content-Disposition", contentDisposition)
  }
  // Forward Set-Cookie from backend to browser.
  // The backend sets refresh_token with Path=/api so the browser sends it with every
  // /api/* request, enabling the NextAuth jwt callback to read it via cookies().
  const setCookieValues: string[] =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")!]
        : []
  setCookieValues.forEach((h) => {
    responseHeaders.append("set-cookie", h.replace(/Path=\/api\/auth/gi, "Path=/api/proxy/auth"))
  })
  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  })
}
