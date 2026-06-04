"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import type { Trip, TripSummary, TripStatus } from "@/types/index"
import { Progress } from "@/components/ui/progress"

const STATUS_CONFIG: Record<TripStatus, { label: string; chipClass: string }> = {
  active: { label: "Activo", chipClass: "bg-primary text-on-primary" },
  closed: { label: "Cerrado", chipClass: "bg-surface-container-highest text-on-surface-variant" },
  draft: { label: "Borrador", chipClass: "bg-tertiary-fixed text-tertiary" },
}

const ALL_STATUSES: TripStatus[] = ["active", "closed", "draft"]

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

interface StatusChipProps {
  current: TripStatus
  onChange: (s: TripStatus) => void
  disabled?: boolean
}

export function StatusChip({ current, onChange, disabled }: StatusChipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const { label, chipClass } = STATUS_CONFIG[current]

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity",
          disabled ? "cursor-default opacity-75" : "hover:opacity-80 cursor-pointer",
          chipClass,
        ].join(" ")}
      >
        {label}
        {!disabled && (
          <span className="material-symbols-outlined leading-none" style={{ fontSize: 12 }}>
            {open ? "expand_less" : "expand_more"}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-36 rounded-lg bg-surface-container-lowest shadow-fab border border-outline/10 z-30 py-1 overflow-hidden">
          {ALL_STATUSES.map((s) => {
            const { label: sl, chipClass: sc } = STATUS_CONFIG[s]
            const dotClass = sc.split(" ")[0]
            return (
              <button
                key={s}
                type="button"
                disabled={s === current}
                onClick={() => {
                  setOpen(false)
                  onChange(s)
                }}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors",
                  s === current
                    ? "opacity-50 cursor-default"
                    : "hover:bg-surface-container-low cursor-pointer",
                ].join(" ")}
              >
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                {sl}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface TripCardProps {
  trip: Trip
  summary?: TripSummary
  onStatusChange?: (status: TripStatus) => void
}

export function TripCard({ trip, summary, onStatusChange }: TripCardProps) {
  const { label, chipClass } = STATUS_CONFIG[trip.status]
  const overBudget = summary !== undefined && Number(summary.percentage) > 100

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="block rounded-xl bg-surface-container-lowest shadow-editorial overflow-hidden select-none transition-all duration-150 hover:shadow-fab focus:outline-none focus:ring-2 focus:ring-primary/40"
      aria-label={`Ver viaje ${trip.name}`}
    >
      <article>
        {trip.cover_image_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/proxy/trips/${trip.id}/cover`}
            alt={trip.name}
            className="w-full h-32 object-cover"
          />
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-headline text-base font-semibold text-on-surface truncate">
                {trip.name}
              </p>
              <p className="mt-0.5 text-sm text-on-surface-variant">{trip.destination}</p>
            </div>
            {onStatusChange ? (
              <div
                onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <StatusChip current={trip.status} onChange={onStatusChange} />
              </div>
            ) : (
              <span
                className={`inline-flex items-center flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${chipClass}`}
              >
                {label}
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-on-surface-variant">
            {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
          </p>

          {summary !== undefined && (
            <div className="mt-4 space-y-2">
              <Progress
                value={Number(summary.percentage)}
                indicatorClassName={overBudget ? "bg-error" : undefined}
              />
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>
                  {Number(summary.spent_base).toFixed(2)} / {Number(summary.budget_base).toFixed(2)}{" "}
                  {summary.currency_base}
                </span>
                <div className="flex gap-3">
                  <span>{summary.expense_count} gastos</span>
                  <span>{summary.legs_count} tramos</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  )
}
