import { useQuery } from 'react-query'
import { apiClient } from '../lib/apiClient'
import { StarIcon } from '@heroicons/react/24/solid'
import { StarIcon as StarOutlineIcon, BuildingStorefrontIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
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

/** When true, hides the large title block so the feed can sit inside a TailAdmin `ComponentCard` shell. */
export default function RestaurantFeed({ embedded = false }: { embedded?: boolean }) {
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
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-theme-sm text-error-600 dark:text-error-400">Failed to load restaurant feed</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="btn-primary rounded-lg px-4 py-2 text-theme-sm"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!feedData?.restaurants?.length) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <BuildingStorefrontIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white/90">No restaurants available</h3>
          <p className="mb-4 text-theme-sm text-gray-500 dark:text-gray-400">
            {feedData?.feed?.feedItems?.[0]?.subtitle ||
              "Sorry, there's nothing available at your delivery address"}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-primary rounded-lg px-4 py-2 text-theme-sm"
          >
            Try again
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
      stars.push(<StarIcon key={i} className="h-4 w-4 text-yellow-400" />)
    }

    if (hasHalfStar) {
      stars.push(<StarIcon key="half" className="h-4 w-4 text-yellow-400" />)
    }

    const remainingStars = 5 - Math.ceil(rating)
    for (let i = 0; i < remainingStars; i++) {
      stars.push(<StarOutlineIcon key={`empty-${i}`} className="h-4 w-4 text-gray-300 dark:text-gray-600" />)
    }

    return stars
  }

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {feedData.count} restaurants available
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm font-medium text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className="h-4 w-4 shrink-0" aria-hidden />
            Refresh
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Restaurant Feed</h2>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">{feedData.count} restaurants available</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ArrowPathIcon className="h-4 w-4 shrink-0" aria-hidden />
            Refresh
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {feedData.restaurants.map((restaurant) => (
          <div
            key={restaurant.uuid}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-sm transition-shadow duration-200 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
          >
            {restaurant.image?.url && (
              <div className="relative h-48 bg-gray-200 dark:bg-gray-800">
                <img
                  src={restaurant.image.url}
                  alt={restaurant.title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            <div className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white/90">{restaurant.title}</h3>
                {restaurant.rating?.value && (
                  <div className="flex shrink-0 items-center space-x-1">
                    {renderStars(restaurant.rating.value)}
                    <span className="ml-1 text-theme-sm text-gray-600 dark:text-gray-400">
                      {restaurant.rating.value.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {restaurant.meta && restaurant.meta.length > 0 && (
                <p className="mb-3 text-theme-sm text-gray-600 dark:text-gray-400">
                  {restaurant.meta.map((item) => item.text).filter(Boolean).join(' • ')}
                </p>
              )}

              <div className="space-y-2">
                {restaurant.signposts && restaurant.signposts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {restaurant.signposts.slice(0, 3).map((signpost, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {signpost.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn-primary mt-4 w-full rounded-lg px-4 py-2 text-theme-sm font-medium"
              >
                View menu
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
