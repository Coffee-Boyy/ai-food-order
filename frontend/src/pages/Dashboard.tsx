import { useQuery } from 'react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import { motion } from 'framer-motion'
import {
  ShoppingBagIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import RestaurantFeed from '../components/RestaurantFeed'

interface DashboardData {
  recentOrders: Array<{
    restaurant_name: string
    total_amount: number
    order_time: string
    time_of_day: string
  }>
  recentPredictions: Array<{
    predicted_restaurant: string
    predicted_items: string[]
    confidence_score: number
    created_at: string
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
      value: dashboardData?.stats.total_orders || 0,
      icon: ShoppingBagIcon,
      color: 'bg-blue-500'
    },
    {
      name: 'Total Predictions',
      value: dashboardData?.stats.total_predictions || 0,
      icon: ChartBarIcon,
      color: 'bg-green-500'
    },
    {
      name: 'Correct Predictions',
      value: dashboardData?.stats.correct_predictions || 0,
      icon: ChartBarIcon,
      color: 'bg-purple-500'
    },
    {
      name: 'Total Spent',
      value: `$${(dashboardData?.stats.total_spent || 0).toFixed(2)}`,
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
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
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
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <ShoppingBagIcon className="h-5 w-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {dashboardData?.recentOrders.length ? (
              dashboardData.recentOrders.map((order, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{order.restaurant_name}</p>
                    <p className="text-sm text-gray-500">{order.time_of_day}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">${order.total_amount}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.order_time).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No recent orders</p>
            )}
          </div>
        </motion.div>

        {/* Recent Predictions */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Predictions</h2>
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {dashboardData?.recentPredictions.length ? (
              dashboardData.recentPredictions.map((prediction, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-gray-900">{prediction.predicted_restaurant}</p>
                    <span className="text-sm text-gray-500">
                      {(prediction.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {prediction.predicted_items.slice(0, 2).join(', ')}
                    {prediction.predicted_items.length > 2 && '...'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(prediction.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No recent predictions</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center p-4 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors duration-200">
            <ClockIcon className="h-5 w-5 mr-2" />
            <span>Generate Prediction</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors duration-200">
            <ShoppingBagIcon className="h-5 w-5 mr-2" />
            <span>Sync Orders</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors duration-200">
            <ChartBarIcon className="h-5 w-5 mr-2" />
            <span>View Analytics</span>
          </button>
        </div>
      </motion.div>

      {/* Restaurant Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.7 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <RestaurantFeed />
      </motion.div>
    </div>
  )
}
