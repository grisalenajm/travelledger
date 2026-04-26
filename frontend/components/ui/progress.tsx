import { cn } from "@/lib/utils"

interface ProgressProps {
  value: number
  className?: string
  indicatorClassName?: string
}

export function Progress({ value, className, indicatorClassName }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-container-high", className)}>
      <div
        className={cn("h-full rounded-full bg-primary transition-all", indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
