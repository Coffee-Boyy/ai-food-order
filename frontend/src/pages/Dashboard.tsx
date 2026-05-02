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
import RestaurantFeed from '../components/RestaurantFeed'
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
  const { user } = useAuth()
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
      refetchInterval: 30000 // Refetch every 30 seconds
    }
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load dashboard data</p>
      </div>
    )
  }

  const stats = [
    {
      name: 'Total Orders',
      value: formatInteger(dashboardData?.stats.total_orders || 0),
      icon: ShoppingBagIcon,
      color: 'bg-blue-500'
    },
    {
      name: 'Recommendations',
      value: formatInteger(dashboardData?.stats.total_predictions || 0),
      icon: ChartBarIcon,
      color: 'bg-green-500'
    },
    {
      name: 'Marked as Liked',
      value: formatInteger(dashboardData?.stats.correct_predictions || 0),
      icon: ChartBarIcon,
      color: 'bg-purple-500'
    },
    {
      name: 'Total Spent',
      value: formatCurrency(dashboardData?.stats.total_spent || 0),
      icon: CurrencyDollarIcon,
      color: 'bg-yellow-500'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.firstName}!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 text-lg font-semibold text-gray-900">
              Recent Orders
            </h2>
            <Link
              to="/orders"
              className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm"
            >
              <ShoppingBagIcon className="h-4 w-4 shrink-0" />
              <span>View all Orders</span>
            </Link>
          </div>

          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {dashboardData?.recentOrders.length ? (
              dashboardData.recentOrders.map((order, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{order.restaurant_name}</p>
                    <p className="text-sm text-gray-500">{order.time_of_day}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.order_time).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-3">No recent orders</p>
            )}
          </div>
        </div>

        {/* Recent recommendations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 text-lg font-semibold text-gray-900">
              Recent Recommendations
            </h2>
            <Link
              to="/recommendations"
              className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm"
            >
              <SparklesIcon className="h-4 w-4 shrink-0" />
              <span>New Recommendation</span>
            </Link>
          </div>

          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {dashboardData?.recentPredictions.length ? (
              dashboardData.recentPredictions.map((recommendation, index) => (
                <div
                  key={recommendation.id || index}
                  className="rounded-lg bg-gray-50 p-2"
                >
                  <p className="min-w-0 truncate font-medium leading-tight text-gray-900">
                    {recommendation.predicted_restaurant}
                  </p>
                  {recommendation.predicted_items.length > 0 && (
                    <p className="mt-0.5 text-sm leading-snug text-gray-600">
                      {recommendation.predicted_items.join(', ')}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      {new Date(recommendation.created_at).toLocaleDateString()}
                    </p>
                    {recommendation.id && (
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => reviseMutation.mutate(recommendation.id)}
                          disabled={recommendationActionsPending}
                          className="rounded-md border border-gray-200 p-1.5 text-gray-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:opacity-50"
                          aria-label="Generate another recommendation"
                          title="Generate another recommendation"
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
                          className="rounded-md border border-gray-200 p-1.5 text-gray-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:opacity-50"
                          aria-label="Delete recommendation"
                          title="Delete recommendation"
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
                              className="rounded-md border border-gray-200 p-1.5 text-green-600 transition-colors hover:border-green-300 hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 disabled:opacity-50"
                              aria-label="Mark recommendation as helpful"
                              title="Helpful"
                            >
                              <HandThumbUpIcon className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRecommendationFeedback(recommendation.id, false)}
                              disabled={recommendationActionsPending}
                              className="rounded-md border border-gray-200 p-1.5 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:opacity-50"
                              aria-label="Mark recommendation as not helpful"
                              title="Not helpful"
                            >
                              <HandThumbDownIcon className="h-4 w-4" aria-hidden />
                            </button>
                          </>
                        )}
                        {recommendation.is_correct !== undefined && (
                          <div
                            className={`flex items-center gap-1 ${recommendation.is_correct ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {recommendation.is_correct ? (
                              <>
                                <HandThumbUpIcon className="h-4 w-4 shrink-0" aria-hidden />
                                <span className="text-xs">Marked as helpful</span>
                              </>
                            ) : (
                              <>
                                <HandThumbDownIcon className="h-4 w-4 shrink-0" aria-hidden />
                                <span className="text-xs">Marked as not helpful</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-3">No recent recommendations</p>
            )}
          </div>
        </div>
      </div>

      {/* Restaurant Feed */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <RestaurantFeed />
      </div>
    </div>
  )
}
