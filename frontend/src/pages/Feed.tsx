import { motion } from 'framer-motion'
import RestaurantFeed from '../components/RestaurantFeed'

export default function Feed() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">Restaurant Feed</h1>
        <p className="text-gray-600 mt-2">
          Discover restaurants available for delivery in your area
        </p>
      </motion.div>

      {/* Restaurant Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <RestaurantFeed />
      </motion.div>
    </div>
  )
}
