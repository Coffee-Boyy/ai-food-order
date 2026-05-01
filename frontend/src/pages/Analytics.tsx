import { useQuery } from 'react-query'
import { useAuth } from '../hooks/useAuth'
import axios from 'axios'
import { motion } from 'framer-motion'
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'

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

export default function Analytics() {
  const { user } = useAuth()

  const { data: analyticsData, isLoading } = useQuery(
    ['analytics'],
    async () => {
      const response = await axios.get('/api/analytics/patterns')
      return response.data as AnalyticsData
    },
    {
      enabled: !!user
    }
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600">Detailed insights into your ordering patterns and preferences</p>
      </div>

      {/* Day of Week Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Order Patterns by Day</h2>
          <CalendarIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          {analyticsData?.dayPatterns.map((pattern, index) => (
            <motion.div
              key={pattern.day_of_week}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-600">
                    {dayNames[pattern.day_of_week].slice(0, 3)}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{dayNames[pattern.day_of_week]}</h3>
                  <p className="text-sm text-gray-500">{pattern.order_count} orders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(pattern.total_spent)}</p>
                <p className="text-sm text-gray-500">Avg: {formatCurrency(pattern.avg_amount)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Time of Day Patterns */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Order Patterns by Time</h2>
          <ClockIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analyticsData?.timePatterns.map((pattern, index) => (
            <motion.div
              key={pattern.time_of_day}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900 capitalize">{pattern.time_of_day}</h3>
                <span className="text-sm text-gray-500">{pattern.order_count} orders</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Total: {formatCurrency(pattern.total_spent)}</p>
                <p className="text-sm text-gray-600">Avg: {formatCurrency(pattern.avg_amount)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Favorite Restaurants */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Favorite Restaurants</h2>
          <ChartBarIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          {analyticsData?.favoriteCuisines.slice(0, 5).map((restaurant, index) => (
            <motion.div
              key={restaurant.restaurant_name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {restaurant.restaurant_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{restaurant.restaurant_name}</h3>
                  <p className="text-sm text-gray-500">{restaurant.order_count} orders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(restaurant.avg_amount)}</p>
                <p className="text-sm text-gray-500">Average order</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Monthly Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Monthly Spending Trends</h2>
          <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          {analyticsData?.monthlyTrends.slice(0, 6).map((trend, index) => (
            <motion.div
              key={trend.month}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div>
                <h3 className="font-medium text-gray-900">
                  {new Date(trend.month).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                  })}
                </h3>
                <p className="text-sm text-gray-500">{trend.order_count} orders</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(trend.total_spent)}</p>
                <p className="text-sm text-gray-500">Avg: {formatCurrency(trend.avg_amount)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Insights Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="card"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Most Active Day</h3>
            <p className="text-blue-700">
              {analyticsData?.dayPatterns.reduce((max, current) => 
                current.order_count > max.order_count ? current : max
              )?.day_of_week !== undefined 
                ? dayNames[analyticsData.dayPatterns.reduce((max, current) => 
                    current.order_count > max.order_count ? current : max
                  ).day_of_week]
                : 'Not enough data'
              }
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-green-900 mb-2">Favorite Time</h3>
            <p className="text-green-700 capitalize">
              {analyticsData?.timePatterns.reduce((max, current) => 
                current.order_count > max.order_count ? current : max
              )?.time_of_day || 'Not enough data'}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
