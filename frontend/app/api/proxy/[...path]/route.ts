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
  const url = `${API_INTERNAL_URL}/api/${pathSegments.join("/")}${req.nextUrl.search}`

  const incomingContentType = req.headers.get("content-type") ?? ""
  const isMultipart = incomingContentType.startsWith("multipart/form-data")

  const headers: Record<string, string> = {}
  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`
  }
  // Multipart: forward content-type as-is (includes boundary); JSON: force application/json
  if (isMultipart) {
    headers["Content-Type"] = incomingContentType
  } else {
    headers["Content-Type"] = "application/json"
  }

  const hasBody = ["POST", "PUT", "PATCH"].includes(method)
  let body: BodyInit | undefined
  if (hasBody) {
    body = isMultipart ? await req.arrayBuffer() : await req.text()
  }

  const response = await fetch(url, { method, headers, body })

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const responseBody = await response.arrayBuffer()
  const contentType = response.headers.get("content-type") ?? "application/json"
  const contentDisposition = response.headers.get("content-disposition")
  const responseHeaders: Record<string, string> = { "Content-Type": contentType }
  if (contentDisposition) {
    responseHeaders["Content-Disposition"] = contentDisposition
  }
  return new NextResponse(responseBody, {
    status: response.status,
    headers: responseHeaders,
  })
}
