"use client"

import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  id: string
  label: string
  summary?: string
  expandedBox: string | null
  onToggle: (id: string) => void
  isMobile: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  id,
  label,
  summary,
  expandedBox,
  onToggle,
  isMobile,
  children,
}: CollapsibleSectionProps) {
  const isExpanded = !isMobile || expandedBox === id

  return (
    <div className="rounded-xl bg-surface-container-lowest overflow-hidden shadow-editorial transition-all duration-300">
      <div
        className={cn(
          "flex items-center justify-between px-4 h-14",
          isMobile && "cursor-pointer select-none"
        )}
        onClick={isMobile ? () => onToggle(id) : undefined}
      >
        <h2 className="font-headline text-sm font-semibold text-on-surface-variant uppercase tracking-wide">
          {label}
        </h2>
        <div className="flex items-center gap-2">
          {summary && (
            <span className="text-sm font-semibold text-on-surface">{summary}</span>
          )}
          {isMobile && (
            <span className="material-symbols-outlined text-on-surface-variant text-base leading-none">
              {isExpanded ? "expand_less" : "expand_more"}
            </span>
          )}
        </div>
      </div>
      <div className={cn("px-4 pb-4 space-y-3", isMobile && !isExpanded && "hidden")}>
        {children}
      </div>
    </div>
  )
}
