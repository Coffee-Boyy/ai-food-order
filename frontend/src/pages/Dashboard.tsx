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
  HandThumbDownIcon
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
  recentPredictions: Array<{
    id: string
    predicted_restaurant: string
    predicted_items: string[]
    confidence_score: number
    created_at: string
    is_correct?: boolean
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
    async ({ predictionId, isCorrect }: { predictionId: string; isCorrect: boolean }) => {
      await apiClient.post('/api/predictions/feedback', {
        predictionId,
        isCorrect
      })
    },
    {
      onSuccess: () => {
        toast.success('Feedback submitted!')
        queryClient.invalidateQueries(['predictions'])
        queryClient.invalidateQueries(['predictionAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: () => {
        toast.error('Failed to submit feedback')
      }
    }
  )

  const handlePredictionFeedback = (predictionId: string, isCorrect: boolean) => {
    feedbackMutation.mutate({ predictionId, isCorrect })
  }

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
      name: 'Total Predictions',
      value: formatInteger(dashboardData?.stats.total_predictions || 0),
      icon: ChartBarIcon,
      color: 'bg-green-500'
    },
    {
      name: 'Correct Predictions',
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
              className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm"
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

        {/* Recent Predictions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 text-lg font-semibold text-gray-900">
              Recent Predictions
            </h2>
            <Link
              to="/predictions"
              className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm"
            >
              <SparklesIcon className="h-4 w-4 shrink-0" />
              <span>New Prediction</span>
            </Link>
          </div>

          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {dashboardData?.recentPredictions.length ? (
              dashboardData.recentPredictions.map((prediction, index) => (
                <div
                  key={prediction.id || index}
                  className="rounded-lg bg-gray-50 p-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-gray-900">
                      {prediction.predicted_restaurant}
                    </p>
                    <span className="shrink-0 text-sm text-gray-500">
                      {(prediction.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {prediction.predicted_items.slice(0, 2).join(', ')}
                    {prediction.predicted_items.length > 2 && '...'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">
                      {new Date(prediction.created_at).toLocaleDateString()}
                    </p>
                    {prediction.id && prediction.is_correct === undefined && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePredictionFeedback(prediction.id, true)}
                          disabled={feedbackMutation.isLoading}
                          className="rounded-md border border-gray-200 p-1.5 text-green-600 transition-colors hover:border-green-300 hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 disabled:opacity-50"
                          aria-label="Mark prediction as correct"
                          title="Correct"
                        >
                          <HandThumbUpIcon className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePredictionFeedback(prediction.id, false)}
                          disabled={feedbackMutation.isLoading}
                          className="rounded-md border border-gray-200 p-1.5 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 disabled:opacity-50"
                          aria-label="Mark prediction as incorrect"
                          title="Incorrect"
                        >
                          <HandThumbDownIcon className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    )}
                    {prediction.is_correct !== undefined && (
                      <div
                        className={`flex shrink-0 items-center gap-1 ${prediction.is_correct ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {prediction.is_correct ? (
                          <>
                            <HandThumbUpIcon className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="text-xs">Marked as liked</span>
                          </>
                        ) : (
                          <>
                            <HandThumbDownIcon className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="text-xs">Marked as not liked</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-3">No recent predictions</p>
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
