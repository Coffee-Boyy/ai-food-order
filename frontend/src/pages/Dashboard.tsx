import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import {
  ShoppingBagIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowPathIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import StatCard from '../components/StatCard'
import RestaurantFeed from '../components/RestaurantFeed'
import ComponentCard from '../components/ComponentCard'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../components/ui/table'
import toast from 'react-hot-toast'

const formatInteger = (n: number) => n.toLocaleString('en-US')

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)

interface DashboardData {
  recentOrders: Array<{
    restaurant_name: string
    total_amount: number
    order_time: string
    time_of_day: string
  }>
  /** Recent AI recommendations (API field name unchanged). */
  recentPredictions: Array<{
    id: string
    predicted_restaurant: string
    predicted_items: string[]
    confidence_score: number
    created_at: string
    is_correct?: boolean
    revision_of?: string
  }>
  stats: {
    total_orders: number
    total_predictions: number
    correct_predictions: number
    total_spent: number
  }
}

export default function Dashboard() {
  const { user, uberSession } = useAuth()
  const queryClient = useQueryClient()

  const feedbackMutation = useMutation(
    async ({ recommendationId, isCorrect }: { recommendationId: string; isCorrect: boolean }) => {
      await apiClient.post('/api/predictions/feedback', {
        predictionId: recommendationId,
        isCorrect
      })
    },
    {
      onSuccess: () => {
        toast.success('Feedback submitted!')
        queryClient.invalidateQueries(['recommendations'])
        queryClient.invalidateQueries(['recommendationAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: () => {
        toast.error('Failed to submit feedback')
      }
    }
  )

  const handleRecommendationFeedback = (recommendationId: string, isCorrect: boolean) => {
    feedbackMutation.mutate({ recommendationId, isCorrect })
  }

  const reviseMutation = useMutation(
    async (recommendationId: string) => {
      return apiClient.post('/api/predictions/revise', { predictionId: recommendationId })
    },
    {
      onSuccess: () => {
        toast.success('New recommendation generated!')
        queryClient.invalidateQueries(['recommendations'])
        queryClient.invalidateQueries(['recommendationAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: () => {
        toast.error('Failed to generate a new recommendation')
      }
    }
  )

  const deleteMutation = useMutation(
    async (recommendationId: string) => {
      return apiClient.delete<{ success: boolean }>(
        `/api/predictions/${encodeURIComponent(recommendationId)}`
      )
    },
    {
      onSuccess: () => {
        toast.success('Recommendation removed')
        queryClient.invalidateQueries(['recommendations'])
        queryClient.invalidateQueries(['recommendationAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: () => {
        toast.error('Failed to delete recommendation')
      }
    }
  )

  const handleDeleteRecommendation = (recommendationId: string) => {
    if (!window.confirm('Delete this recommendation? This cannot be undone.')) return
    deleteMutation.mutate(recommendationId)
  }

  const recommendationActionsPending =
    feedbackMutation.isLoading || reviseMutation.isLoading || deleteMutation.isLoading

  const { data: dashboardData, isLoading, error } = useQuery<DashboardData>(
    ['dashboard'],
    async () => {
      return apiClient.get<DashboardData>('/api/users/dashboard')
    },
    {
      enabled: !!user,
      refetchInterval: 30000
    }
  )

  if (isLoading) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">Loading dashboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error-200 bg-error-50 px-6 py-10 text-center dark:border-error-500/30 dark:bg-error-500/10">
        <p className="font-medium text-error-800 dark:text-error-300">Failed to load dashboard data</p>
        <p className="mt-2 text-theme-sm text-error-700/90 dark:text-error-400/90">
          Try refreshing the page or check your connection.
        </p>
      </div>
    )
  }

  const stats = [
    {
      name: 'Total orders',
      value: formatInteger(dashboardData?.stats.total_orders || 0),
      icon: ShoppingBagIcon,
      iconClass: 'text-primary-600 dark:text-primary-400'
    },
    {
      name: 'Recommendations',
      value: formatInteger(dashboardData?.stats.total_predictions || 0),
      icon: ChartBarIcon,
      iconClass: 'text-success-600 dark:text-success-400'
    },
    {
      name: 'Marked as liked',
      value: formatInteger(dashboardData?.stats.correct_predictions || 0),
      icon: ChartBarIcon,
      iconClass: 'text-secondary-600 dark:text-secondary-400'
    },
    {
      name: 'Total spent',
      value: formatCurrency(dashboardData?.stats.total_spent || 0),
      icon: CurrencyDollarIcon,
      iconClass: 'text-warning-600 dark:text-warning-400'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-sm font-bold text-gray-900 dark:text-white/90">Dashboard</h1>
        <p className="mt-1 text-theme-sm text-gray-600 dark:text-gray-400">
          Welcome back, {user?.firstName}!
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat) => (
          <StatCard
            key={stat.name}
            label={stat.name}
            value={stat.value}
            icon={stat.icon}
            iconClass={stat.iconClass}
          />
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-6">
        <ComponentCard
          title="Recent orders"
          desc="Latest orders synced from your account."
          contentFlush
          contentFlushTight
          actions={
            <Link
              to="/orders"
              className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-theme-sm"
            >
              <ShoppingBagIcon className="h-4 w-4 shrink-0" aria-hidden />
              View all orders
            </Link>
          }
        >
          <div className="min-w-0 w-full overflow-x-hidden">
            <div className="custom-scrollbar max-h-72 w-full overflow-y-auto overscroll-y-contain scrollbar-gutter-stable">
              {dashboardData?.recentOrders.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
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
                        Total
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-5 py-3 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Date
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.recentOrders.map((order, index) => (
                      <TableRow key={index}>
                        <TableCell className="min-w-0 px-5 py-4 align-middle text-start">
                          <span className="block truncate font-medium text-theme-sm text-gray-800 dark:text-white/90">
                            {order.restaurant_name}
                          </span>
                          <p className="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                            {order.time_of_day}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-5 py-4 text-end align-middle text-theme-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
                          {formatCurrency(order.total_amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-5 py-4 text-end align-middle text-theme-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {new Date(order.order_time).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-6 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                  No recent orders
                </p>
              )}
            </div>
          </div>
        </ComponentCard>

        <ComponentCard
          title="Recent recommendations"
          desc="AI suggestions and your feedback."
          contentFlush
          contentFlushTight
          actions={
            <Link
              to="/recommendations"
              className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-theme-sm"
            >
              <SparklesIcon className="h-4 w-4 shrink-0" aria-hidden />
              New recommendation
            </Link>
          }
        >
          <div className="min-w-0 w-full overflow-x-hidden">
            <div className="custom-scrollbar max-h-72 w-full overflow-y-auto overscroll-y-contain scrollbar-gutter-stable">
              {dashboardData?.recentPredictions.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-5 py-3 text-start font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Place
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-5 py-3 text-start font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Items
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-5 py-3 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Date
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="min-w-[10.5rem] px-5 py-3 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData.recentPredictions.map((recommendation, index) => (
                      <TableRow key={recommendation.id || index}>
                        <TableCell className="min-w-0 px-5 py-4 align-middle text-start">
                          <span className="block truncate font-medium text-theme-sm text-gray-800 dark:text-white/90">
                            {recommendation.predicted_restaurant}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0 px-5 py-4 align-middle text-start text-theme-sm text-gray-600 dark:text-gray-400">
                          <span className="line-clamp-2" title={recommendation.predicted_items.join(', ')}>
                            {recommendation.predicted_items.length
                              ? recommendation.predicted_items.join(', ')
                              : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-5 py-4 text-end align-middle text-theme-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {new Date(recommendation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="min-w-[10.5rem] whitespace-nowrap px-5 py-4 text-end align-middle">
                          <div className="inline-flex shrink-0 flex-nowrap items-center justify-end gap-1">
                            {recommendation.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => reviseMutation.mutate(recommendation.id)}
                                  disabled={recommendationActionsPending}
                                  className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-gray-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-primary-500/10"
                                  aria-label="Generate another recommendation"
                                  title="Regenerate"
                                >
                                  <ArrowPathIcon
                                    className={`h-4 w-4 ${reviseMutation.isLoading && reviseMutation.variables === recommendation.id ? 'animate-spin' : ''}`}
                                    aria-hidden
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRecommendation(recommendation.id)}
                                  disabled={recommendationActionsPending}
                                  className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-gray-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-red-500/10"
                                  aria-label="Delete recommendation"
                                  title="Delete"
                                >
                                  <TrashIcon
                                    className={`h-4 w-4 ${deleteMutation.isLoading && deleteMutation.variables === recommendation.id ? 'opacity-50' : ''}`}
                                    aria-hidden
                                  />
                                </button>
                                {recommendation.is_correct === undefined && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleRecommendationFeedback(recommendation.id, true)}
                                      disabled={recommendationActionsPending}
                                      className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-success-600 transition-colors hover:border-success-300 hover:bg-success-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-success-500 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-success-500/10"
                                      aria-label="Mark as helpful"
                                      title="Helpful"
                                    >
                                      <HandThumbUpIcon className="h-4 w-4" aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRecommendationFeedback(recommendation.id, false)}
                                      disabled={recommendationActionsPending}
                                      className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-error-600 transition-colors hover:border-error-300 hover:bg-error-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-error-500/10"
                                      aria-label="Mark as not helpful"
                                      title="Not helpful"
                                    >
                                      <HandThumbDownIcon className="h-4 w-4" aria-hidden />
                                    </button>
                                  </>
                                )}
                                {recommendation.is_correct !== undefined && (
                                  <span
                                    className={`inline-flex shrink-0 items-center gap-1 text-theme-xs whitespace-nowrap ${recommendation.is_correct ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}
                                  >
                                    {recommendation.is_correct ? (
                                      <>
                                        <HandThumbUpIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                        Liked
                                      </>
                                    ) : (
                                      <>
                                        <HandThumbDownIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                        Not liked
                                      </>
                                    )}
                                  </span>
                                )}
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="px-6 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                  {uberSession?.connected
                    ? 'No recent recommendations'
                    : 'Connect your UberEats session in Settings to see AI recommendations here.'}
                </p>
              )}
            </div>
          </div>
        </ComponentCard>
      </div>

      <ComponentCard title="Restaurant feed" desc="Places near your delivery address.">
        <RestaurantFeed embedded />
      </ComponentCard>
    </div>
  )
}
