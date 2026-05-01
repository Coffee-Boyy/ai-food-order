import { useQuery } from 'react-query'
import { apiClient } from '../lib/apiClient'
import { motion } from 'framer-motion'
import { StarIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/solid'
import { StarIcon as StarOutlineIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from './LoadingSpinner'

interface Restaurant {
  uuid: string
  title: string
  meta?: Array<{
    text?: string
    type?: string
  }>
  rating?: {
    value?: number
    count?: number
  }
  image?: {
    url?: string
  }
  signposts?: Array<{
    text?: string
    type?: string
  }>
  favorite?: boolean
}

interface FeedData {
  feed: any
  restaurants: Restaurant[]
  count: number
}

export default function RestaurantFeed() {
  const { data: feedData, isLoading, error, refetch } = useQuery<FeedData>(
    ['restaurant-feed'],
    async () => {
      return apiClient.get<FeedData>('/api/orders/feed')
    },
    {
      refetchInterval: 60000, // Refetch every minute
      staleTime: 30000 // Consider data stale after 30 seconds
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
        <p className="text-red-600 mb-4">Failed to load restaurant feed</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!feedData?.restaurants?.length) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <BuildingStorefrontIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Restaurants Available</h3>
          <p className="text-gray-500 mb-4">
            {feedData.feed?.feedItems?.[0]?.subtitle || "Sorry, there's nothing available at your delivery address"}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const renderStars = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <StarIcon key={i} className="h-4 w-4 text-yellow-400" />
      )
    }

    if (hasHalfStar) {
      stars.push(
        <StarIcon key="half" className="h-4 w-4 text-yellow-400" />
      )
    }

    const remainingStars = 5 - Math.ceil(rating)
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <StarOutlineIcon key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
      )
    }

    return stars
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Restaurant Feed</h2>
          <p className="text-sm text-gray-500">
            {feedData.count} restaurants available
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Restaurant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {feedData.restaurants.map((restaurant, index) => (
          <motion.div
            key={restaurant.uuid}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
          >
            {/* Restaurant Image */}
            {restaurant.image?.url && (
              <div className="h-48 bg-gray-200 relative">
                <img
                  src={restaurant.image.url}
                  alt={restaurant.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* Restaurant Info */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-lg truncate">
                  {restaurant.title}
                </h3>
                {restaurant.rating?.value && (
                  <div className="flex items-center space-x-1">
                    {renderStars(restaurant.rating.value)}
                    <span className="text-sm text-gray-600 ml-1">
                      {restaurant.rating.value.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* Meta information (cuisine, etc.) */}
              {restaurant.meta && restaurant.meta.length > 0 && (
                <p className="text-sm text-gray-600 mb-3">
                  {restaurant.meta.map(item => item.text).filter(Boolean).join(' • ')}
                </p>
              )}

              {/* Restaurant Details */}
              <div className="space-y-2">
                {restaurant.signposts && restaurant.signposts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {restaurant.signposts.slice(0, 3).map((signpost, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {signpost.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200">
                View Menu
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
