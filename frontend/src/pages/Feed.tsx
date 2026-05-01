import RestaurantFeed from '../components/RestaurantFeed'

export default function Feed() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Restaurant Feed</h1>
        <p className="text-gray-600 mt-2">
          Discover restaurants available for delivery in your area
        </p>
      </div>

      {/* Restaurant Feed */}
      <div>
        <RestaurantFeed />
      </div>
    </div>
  )
}
