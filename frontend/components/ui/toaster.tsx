"use client"

import { useToastState } from "@/hooks/use-toast"

const VARIANT_STYLES: Record<string, string> = {
  warning: "bg-amber-500 text-white",
  error: "bg-red-600 text-white",
  success: "bg-green-600 text-white",
}

export function Toaster() {
  const toasts = useToastState()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-24 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`max-w-sm w-full px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto ${VARIANT_STYLES[t.variant]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
