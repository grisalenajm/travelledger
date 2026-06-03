import { redirect } from "next/navigation"
import { SetupForm } from "./setup-form"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:8000"
  try {
    const res = await fetch(`${apiUrl}/api/auth/status`, { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      if (data.has_users) {
        redirect("/login")
      }
    }
  } catch {
    // Backend no disponible — mostrar el formulario igualmente (el POST fallará con error claro)
  }

  return <SetupForm />
}
