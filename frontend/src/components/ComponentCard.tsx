import type { ReactNode } from 'react'

/** TailAdmin-style section card */
export default function ComponentCard({
  title,
  children,
  className = '',
  desc,
  actions,
  /** Drop horizontal padding so tables or grids can span the full inner width of the card */
  contentFlush = false,
  /** With contentFlush: remove vertical padding so tables sit flush under the header */
  contentFlushTight = false
}: {
  title: string
  children: ReactNode
  className?: string
  desc?: string
  actions?: ReactNode
  contentFlush?: boolean
  contentFlushTight?: boolean
}) {
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-white/[0.05]">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">{title}</h3>
          {desc ? (
            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">{desc}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : null}
      </div>
      <div
        className={
          contentFlush
            ? contentFlushTight
              ? 'min-w-0 px-0 py-0'
              : 'min-w-0 px-0 py-4 sm:py-6'
            : 'min-w-0 p-4 sm:p-6'
        }
      >
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  )
}
