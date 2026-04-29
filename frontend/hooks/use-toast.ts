"use client"

import { useState, useEffect } from "react"

export type ToastVariant = "warning" | "error" | "success"

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

let _nextId = 0
let _toasts: ToastItem[] = []
const _listeners = new Set<(t: ToastItem[]) => void>()

function _notify() {
  _listeners.forEach((fn) => fn([..._toasts]))
}

function _add(message: string, variant: ToastVariant, duration = 5000) {
  const id = _nextId++
  _toasts = [..._toasts, { id, message, variant }]
  _notify()
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id)
    _notify()
  }, duration)
}

export const toast = {
  warning: (message: string) => _add(message, "warning"),
  error: (message: string) => _add(message, "error"),
  success: (message: string) => _add(message, "success"),
}

export function useToastState(): ToastItem[] {
  const [state, setState] = useState<ToastItem[]>([])
  useEffect(() => {
    _listeners.add(setState)
    return () => {
      _listeners.delete(setState)
    }
  }, [])
  return state
}
