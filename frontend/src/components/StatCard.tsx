import type { ComponentType, SVGProps } from 'react'

export type StatCardIcon = ComponentType<SVGProps<SVGSVGElement>>

export interface StatCardProps {
  label: string
  value: string | number
  icon: StatCardIcon
  /** e.g. `text-primary-600 dark:text-primary-400` */
  iconClass: string
  capitalizeValue?: boolean
  className?: string
}

/** KPI stat tile (Dashboard, Orders, Analytics). */
export default function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
  capitalizeValue = false,
  className = ''
}: StatCardProps) {
  const valueStr = typeof value === 'number' ? String(value) : value

  return (
    <div
      className={`flex h-[5.75rem] items-center gap-5 overflow-hidden rounded-2xl border border-gray-200 bg-white px-6 py-3.5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] ${className}`.trim()}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
        <Icon className={`size-6 ${iconClass}`} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <span className="block line-clamp-1 text-theme-sm text-gray-500 dark:text-gray-400" title={label}>
          {label}
        </span>
        <p
          className={`mt-1 truncate text-2xl font-bold tabular-nums text-gray-800 dark:text-white/90 ${capitalizeValue ? 'capitalize' : ''}`}
          title={valueStr}
        >
          {valueStr}
        </p>
      </div>
    </div>
  )
}
