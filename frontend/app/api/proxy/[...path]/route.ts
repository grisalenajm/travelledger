import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

const BACKEND =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000"

const NO_BODY = new Set(["GET", "HEAD", "DELETE"])

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }

  const target = `${BACKEND}/api/${params.path.join("/")}${req.nextUrl.search}`

  const headers = new Headers()
  headers.set("Authorization", `Bearer ${session.accessToken}`)
  const ct = req.headers.get("content-type")
  if (ct) headers.set("content-type", ct)

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: NO_BODY.has(req.method) ? undefined : await req.arrayBuffer(),
  })

  // 204 No Content — cuerpo vacío
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  const upstreamCT = upstream.headers.get("content-type") ?? "application/json"
  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: { "content-type": upstreamCT },
  })
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH }
