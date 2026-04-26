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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`
  }

  const hasBody = ["POST", "PUT", "PATCH"].includes(method)
  const body = hasBody ? await req.text() : undefined

  const response = await fetch(url, { method, headers, body })

  const text = await response.text()
  return new NextResponse(text, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  })
}
