import { useMemo } from 'react'
import { useQuery } from 'react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CalendarDaysIcon,
  SunIcon,
  MoonIcon,
  SparklesIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import StatCard from '../components/StatCard'
import ComponentCard from '../components/ComponentCard'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../components/ui/table'

interface AnalyticsData {
  dayPatterns: Array<{
    day_of_week: number
    order_count: number
    avg_amount: number
    total_spent: number
  }>
  timePatterns: Array<{
    time_of_day: string
    order_count: number
    avg_amount: number
    total_spent: number
  }>
  monthlyTrends: Array<{
    month: string
    order_count: number
    total_spent: number
    avg_amount: number
  }>
  favoriteCuisines: Array<{
    restaurant_name: string
    order_count: number
    avg_amount: number
  }>
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Canonical slots — matches RecommendationWhenPicker & order normalization. */
const TIME_OF_DAY_ORDER = ['breakfast', 'lunch', 'dinner', 'late_night'] as const

const timeOfDayLabel: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  late_night: 'Late night'
}

const timeOfDayIcon: Record<string, typeof SunIcon> = {
  breakfast: SunIcon,
  lunch: ClockIcon,
  dinner: MoonIcon,
  late_night: SparklesIcon
}

function accumulateCanonicalTimePatterns(
  patterns: AnalyticsData['timePatterns'] | undefined
): AnalyticsData['timePatterns'] {
  const acc = new Map<string, { order_count: number; total_spent: number }>()
  for (const p of patterns ?? []) {
    const key = p.time_of_day === 'morning' ? 'breakfast' : p.time_of_day
    const cur = acc.get(key) ?? { order_count: 0, total_spent: 0 }
    acc.set(key, {
      order_count: cur.order_count + p.order_count,
      total_spent: cur.total_spent + p.total_spent
    })
  }
  const out: AnalyticsData['timePatterns'] = []
  acc.forEach((v, time_of_day) => {
    out.push({
      time_of_day,
      order_count: v.order_count,
      total_spent: v.total_spent,
      avg_amount: v.order_count > 0 ? v.total_spent / v.order_count : 0
    })
  })
  return out
}

function mergeTimeSlotsWithDefaults(
  folded: AnalyticsData['timePatterns']
): AnalyticsData['timePatterns'] {
  const map = new Map(folded.map((p) => [p.time_of_day, p]))
  return TIME_OF_DAY_ORDER.map((key) => {
    const existing = map.get(key)
    if (existing) return existing
    return {
      time_of_day: key,
      order_count: 0,
      total_spent: 0,
      avg_amount: 0
    }
  })
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)

function formatMonthLabel(monthIso: string) {
  try {
    return new Date(monthIso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    })
  } catch {
    return monthIso
  }
}

export default function Analytics() {
  const { user } = useAuth()

  const { data: analyticsData, isLoading } = useQuery(
    ['analytics'],
    async () => {
      return apiClient.get<AnalyticsData>('/api/analytics/patterns')
    },
    {
      enabled: !!user
    }
  )

  const canonicalDisplayTimePatterns = useMemo(() => {
    if (!analyticsData) return []
    const folded = accumulateCanonicalTimePatterns(analyticsData.timePatterns)
    return mergeTimeSlotsWithDefaults(folded)
  }, [analyticsData])

  const summary = useMemo(() => {
    if (!analyticsData) return null
    const { dayPatterns, monthlyTrends, favoriteCuisines } = analyticsData

    const totalOrders = dayPatterns.reduce((s, d) => s + d.order_count, 0)
    const totalSpent = dayPatterns.reduce((s, d) => s + d.total_spent, 0)
    const maxDayOrders =
      dayPatterns.length > 0 ? Math.max(1, ...dayPatterns.map((d) => d.order_count)) : 1
    const maxMonthSpend =
      monthlyTrends.length > 0 ? Math.max(1, ...monthlyTrends.map((m) => m.total_spent)) : 1

    const busiestDay =
      dayPatterns.length > 0
        ? dayPatterns.reduce((a, b) => (a.order_count >= b.order_count ? a : b))
        : null
    const busiestTime =
      canonicalDisplayTimePatterns.length > 0
        ? canonicalDisplayTimePatterns.reduce((a, b) =>
            a.order_count >= b.order_count ? a : b
          )
        : null
    const topSpot =
      favoriteCuisines.length > 0
        ? favoriteCuisines.reduce((a, b) => (a.order_count >= b.order_count ? a : b))
        : null

    return {
      totalOrders,
      totalSpent,
      maxDayOrders,
      maxMonthSpend,
      busiestDay,
      busiestTime,
      topSpot
    }
  }, [analyticsData, canonicalDisplayTimePatterns])

  const sortedDayPatterns = useMemo(() => {
    if (!analyticsData?.dayPatterns.length) return []
    return [...analyticsData.dayPatterns].sort((a, b) => a.day_of_week - b.day_of_week)
  }, [analyticsData?.dayPatterns])

  const maxTimeOrders = useMemo(() => {
    if (canonicalDisplayTimePatterns.length === 0) return 1
    return Math.max(1, ...canonicalDisplayTimePatterns.map((t) => t.order_count))
  }, [canonicalDisplayTimePatterns])

  if (isLoading) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">Loading analytics…</p>
      </div>
    )
  }

  const isCompletelyEmpty =
    !!analyticsData &&
    !analyticsData.dayPatterns.length &&
    !analyticsData.timePatterns.length &&
    !analyticsData.monthlyTrends.length &&
    !analyticsData.favoriteCuisines.length

  const kpiStats =
    summary && !isCompletelyEmpty
      ? [
          {
            name: 'Orders (in view)',
            value: summary.totalOrders.toLocaleString('en-US'),
            icon: ShoppingBagIcon,
            iconClass: 'text-primary-600 dark:text-primary-400'
          },
          {
            name: 'Spend by day window',
            value: formatCurrency(summary.totalSpent),
            icon: CurrencyDollarIcon,
            iconClass: 'text-warning-600 dark:text-warning-400'
          },
          {
            name: 'Busiest day',
            value: summary.busiestDay ? dayNames[summary.busiestDay.day_of_week] : '—',
            icon: CalendarDaysIcon,
            iconClass: 'text-secondary-600 dark:text-secondary-400'
          },
          {
            name: 'Peak time',
            value: summary.busiestTime
              ? timeOfDayLabel[summary.busiestTime.time_of_day] ?? summary.busiestTime.time_of_day
              : '—',
            icon: ClockIcon,
            iconClass: 'text-success-600 dark:text-success-400',
            capitalizeValue: true
          }
        ]
      : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-sm font-bold text-gray-900 dark:text-white/90">Analytics</h1>
        <p className="mt-1 text-theme-sm text-gray-600 dark:text-gray-400">
          Ordering patterns, spend, and habits from your synced history
        </p>
      </div>

      {kpiStats ? (
        <div className="grid grid-cols-4 gap-6">
          {kpiStats.map((stat) => (
            <StatCard
              key={stat.name}
              label={stat.name}
              value={stat.value}
              icon={stat.icon}
              iconClass={stat.iconClass}
              capitalizeValue={stat.capitalizeValue}
            />
          ))}
        </div>
      ) : null}

      {isCompletelyEmpty ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-10 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <ChartBarIcon className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" aria-hidden />
          <p className="mt-3 font-medium text-gray-800 dark:text-white/90">Not enough data yet</p>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            Once orders are synced, you&apos;ll see charts and breakdowns here.
          </p>
        </div>
      ) : null}

      {!isCompletelyEmpty ? (
      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <ComponentCard
          title="Orders by day of week"
          desc="Relative volume across the week."
          actions={<CalendarDaysIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden />}
        >
          <div className="space-y-4">
            {summary && sortedDayPatterns.length > 0 ? sortedDayPatterns.map((pattern) => {
              const pct = (pattern.order_count / summary.maxDayOrders) * 100
              return (
                <div key={pattern.day_of_week} className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-theme-sm">
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {dayNames[pattern.day_of_week]}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                      {pattern.order_count} orders · {formatCurrency(pattern.total_spent)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-primary-500 to-primary-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    Avg order {formatCurrency(pattern.avg_amount)}
                  </p>
                </div>
              )
            }) : (
              <p className="text-center text-theme-sm text-gray-500 dark:text-gray-400">
                No day-of-week breakdown yet
              </p>
            )}
          </div>
        </ComponentCard>

        <ComponentCard
          title="Orders by time of day"
          desc="How often you order in each part of the day."
          actions={<ClockIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden />}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {canonicalDisplayTimePatterns.map((pattern) => {
              const Icon = timeOfDayIcon[pattern.time_of_day] ?? ClockIcon
              const pct = (pattern.order_count / maxTimeOrders) * 100
              return (
                <div
                  key={pattern.time_of_day}
                  className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-white/[0.06] dark:bg-gray-900/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-theme-xs ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700">
                        <Icon className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium capitalize text-gray-800 dark:text-white/90">
                          {timeOfDayLabel[pattern.time_of_day] ?? pattern.time_of_day}
                        </p>
                        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                          {pattern.order_count} orders
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200/90 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-secondary-500 to-primary-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-theme-xs text-gray-600 dark:text-gray-400">
                    <span>Total {formatCurrency(pattern.total_spent)}</span>
                    <span className="tabular-nums">Avg {formatCurrency(pattern.avg_amount)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </ComponentCard>
      </div>
      ) : null}

      {!isCompletelyEmpty ? (
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <ComponentCard
          title="Top restaurants"
          desc="By order count from your history."
          actions={<BuildingStorefrontIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden />}
          contentFlush
          contentFlushTight
        >
          <div className="min-w-0 w-full overflow-x-hidden">
            {analyticsData?.favoriteCuisines?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell
                      isHeader
                      scope="col"
                      className="px-5 py-3 text-start font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                    >
                      #
                    </TableCell>
                    <TableCell
                      isHeader
                      scope="col"
                      className="px-5 py-3 text-start font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                    >
                      Restaurant
                    </TableCell>
                    <TableCell
                      isHeader
                      scope="col"
                      className="px-5 py-3 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                    >
                      Orders
                    </TableCell>
                    <TableCell
                      isHeader
                      scope="col"
                      className="px-5 py-3 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                    >
                      Avg order
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyticsData.favoriteCuisines.slice(0, 8).map((r, i) => (
                    <TableRow key={r.restaurant_name}>
                      <TableCell className="whitespace-nowrap px-5 py-4 align-middle text-theme-sm tabular-nums text-gray-500 dark:text-gray-400">
                        {i + 1}
                      </TableCell>
                      <TableCell className="min-w-0 px-5 py-4 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-secondary-500 text-theme-sm font-semibold text-white shadow-theme-xs">
                            {r.restaurant_name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate font-medium text-theme-sm text-gray-800 dark:text-white/90">
                            {r.restaurant_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-5 py-4 text-end align-middle text-theme-sm tabular-nums text-gray-800 dark:text-white/90">
                        {r.order_count}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-5 py-4 text-end align-middle text-theme-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
                        {formatCurrency(r.avg_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-6 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                No restaurant breakdown yet
              </p>
            )}
          </div>
        </ComponentCard>

        <ComponentCard
          title="Monthly spend"
          desc="Recent months — bar height follows total spend."
          actions={<ArrowTrendingUpIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden />}
        >
          {analyticsData?.monthlyTrends?.length ? (
            <div className="space-y-6">
              <div className="flex h-40 items-end justify-between gap-2 border-b border-gray-100 pb-1 dark:border-white/[0.06]">
                {analyticsData.monthlyTrends.slice(0, 6).map((trend) => {
                  const h = summary ? (trend.total_spent / summary.maxMonthSpend) * 100 : 0
                  return (
                    <div key={trend.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-theme-xs font-medium tabular-nums text-gray-800 dark:text-white/90">
                        {formatCurrency(trend.total_spent)}
                      </span>
                      <div className="flex w-full max-w-[4rem] flex-1 flex-col justify-end">
                        <div
                          className="w-full min-h-[4px] rounded-t-lg bg-linear-to-t from-primary-600 to-primary-400 shadow-theme-sm transition-all duration-500"
                          style={{ height: `${Math.max(8, (h / 100) * 120)}px` }}
                          title={`${formatMonthLabel(trend.month)}: ${formatCurrency(trend.total_spent)}`}
                        />
                      </div>
                      <span className="max-w-full truncate text-center text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {new Date(trend.month).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="custom-scrollbar max-h-56 overflow-y-auto rounded-xl border border-gray-100 dark:border-white/[0.06]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-4 py-2.5 text-start font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Month
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-4 py-2.5 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Orders
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-4 py-2.5 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Spent
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-4 py-2.5 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Avg
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsData.monthlyTrends.slice(0, 12).map((trend) => (
                      <TableRow key={trend.month}>
                        <TableCell className="px-4 py-3 text-start text-theme-sm text-gray-800 dark:text-white/90">
                          {formatMonthLabel(trend.month)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-end text-theme-sm tabular-nums text-gray-600 dark:text-gray-400">
                          {trend.order_count}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-end text-theme-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
                          {formatCurrency(trend.total_spent)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-end text-theme-sm tabular-nums text-gray-600 dark:text-gray-400">
                          {formatCurrency(trend.avg_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-center text-theme-sm text-gray-500 dark:text-gray-400">No monthly data yet</p>
          )}
        </ComponentCard>
      </div>
      ) : null}

      {!isCompletelyEmpty && summary?.topSpot ? (
        <ComponentCard
          title="Quick take"
          desc="Highest-volume spot in your rankings."
          actions={<ChartBarIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden />}
        >
          <div className="flex flex-col gap-4 rounded-xl border border-primary-100 bg-primary-25/60 p-5 dark:border-primary-500/20 dark:bg-primary-500/5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary-500 to-secondary-500 text-lg font-bold text-white shadow-theme-md">
                {summary.topSpot.restaurant_name.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="text-theme-xs font-medium uppercase tracking-wide text-primary-700 dark:text-primary-300">
                  Most orders
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white/90">
                  {summary.topSpot.restaurant_name}
                </p>
                <p className="text-theme-sm text-gray-600 dark:text-gray-400">
                  {summary.topSpot.order_count} orders · avg {formatCurrency(summary.topSpot.avg_amount)}
                </p>
              </div>
            </div>
          </div>
        </ComponentCard>
      ) : null}
    </div>
  )
}
