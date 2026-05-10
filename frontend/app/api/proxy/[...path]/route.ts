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
    return new NextResponse(null, { status: 204 })
  }

  const responseBody = await response.arrayBuffer()
  const contentType = response.headers.get("content-type") ?? "application/json"
  const contentDisposition = response.headers.get("content-disposition")
  const responseHeaders = new Headers()
  responseHeaders.set("Content-Type", contentType)
  if (contentDisposition) {
    responseHeaders.set("Content-Disposition", contentDisposition)
  }
  // Forward Set-Cookie from backend to browser, rewriting backend path to proxy path
  // so the browser sends the cookie when calling /api/proxy/auth/refresh
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
