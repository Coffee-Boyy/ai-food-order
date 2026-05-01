import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { apiClient } from '../lib/apiClient'
import {
  ShoppingBagIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  EyeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

interface Order {
  id: string
  restaurant_name: string
  total_amount: number
  order_time: string
  time_of_day: string
  day_of_week: number
  items: OrderItem[]
  status: string
  fare_info?: {
    totalPrice: number
    checkoutInfo: Array<{
      label: string
      type: 'credit' | 'debit'
      rawValue: number
      key: string
    }>
  }
  restaurant_details?: {
    name: string
    uuid: string
    slug: string
    isOpen: boolean
    heroImageUrl?: string
    location: {
      address: {
        address1: string
        city: string
        region: string
        postalCode: string
        country: string
      }
      latitude: number
      longitude: number
    }
    contact?: {
      phoneNumber: string
    }
    rating?: boolean[]
    storeStatus: {
      isActive: boolean
      notActiveReason: string
    }
  }
}

interface CustomizationOption {
  price: number
  quantity: number
  title: string
  uuid: string
  childCustomizationList: any[]
}

interface Customization {
  uuid: string
  title: string
  childOptions: {
    options: CustomizationOption[]
  }
  groupId: number
}

interface OrderItem {
  title?: string
  name?: string
  price: number
  quantity: number
  specialInstructions?: string
  customizations?: Customization[]
}

interface UberEatsOrder {
  uuid: string
  baseEaterOrder?: {
    uuid: string
    completedAt?: string
    created_at?: string
    storeUuid?: string
    storeInfo?: {
      uuid: string
      title: string
      slug: string
      isOpen: boolean
      heroImageUrl?: string
      location: {
        address: {
          address1: string
          city: string
          region: string
          postalCode: string
          country: string
        }
        latitude: number
        longitude: number
      }
      contact?: {
        phoneNumber: string
      }
      rating?: boolean[]
      storeStatus: {
        isActive: boolean
        notActiveReason: string
      }
    }
    shoppingCart?: {
      items: OrderItem[]
    }
    fareInfo?: {
      totalPrice: number
      checkoutInfo: Array<{
        label: string
        type: 'credit' | 'debit'
        rawValue: number
        key: string
      }>
    }
    isCompleted?: boolean
    isCancelled?: boolean
  }
  // Root level fields according to schema
  storeInfo?: {
    uuid: string
    title: string
    slug: string
    isOpen: boolean
    heroImageUrl?: string
    location: {
      address: {
        address1: string
        city: string
        region: string
        postalCode: string
        country: string
      }
      latitude: number
      longitude: number
    }
    contact?: {
      phoneNumber: string
    }
    rating?: boolean[]
    storeStatus: {
      isActive: boolean
      notActiveReason: string
    }
  }
  fareInfo?: {
    totalPrice: number
    checkoutInfo: Array<{
      label: string
      type: 'credit' | 'debit'
      rawValue: number
      key: string
    }>
  }
  courierInfo?: {
    name: string
  }
  ratingInfo?: {
    isRatable: boolean
    userRatings: Array<{
      uuid: string
      rating: string
    }>
  }
  interactionType?: string
  items?: OrderItem[]
  restaurant?: {
    name: string
    id: string
  }
  total?: number
  created_at?: string
}

interface OrderStats {
  total_orders: number
  total_spent: number
  avg_order_value: number
  unique_restaurants: number
  order_days: number
}


export default function Orders() {
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [syncProgress, setSyncProgress] = useState<{
    page: number
    cumulative: number
    percent: number
  } | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = window.desktop?.onOrdersSyncProgress?.((payload) => {
      if (payload.type === 'progress') {
        setSyncProgress({
          page: payload.page,
          cumulative: payload.cumulativeOrders,
          percent: payload.percent
        })
      } else if (payload.type === 'complete') {
        setSyncProgress({
          page: payload.pages ?? 0,
          cumulative: payload.cumulativeOrders ?? 0,
          percent: 100
        })
      } else if (payload.type === 'error') {
        setSyncProgress(null)
      }
    })
    return () => unsubscribe?.()
  }, [])

  const syncOrdersMutation = useMutation(
    async () => {
      if (window.desktop?.syncOrdersFull) {
        const res = await window.desktop.syncOrdersFull()
        if (!res.ok) {
          throw new Error(res.error?.message || 'Failed to sync orders')
        }
        return res.data
      }
      return apiClient.post<{ syncedCount?: number; pages?: number }>('/api/orders/sync')
    },
    {
      onMutate: () => {
        setSyncProgress({ page: 0, cumulative: 0, percent: 0 })
      },
      onSuccess: (data) => {
        const count = data?.syncedCount ?? 0
        const pages = data?.pages
        toast.success(
          pages != null
            ? `Synced ${count} orders from UberEats (${pages} page${pages === 1 ? '' : 's'})`
            : `Synced ${count} orders from UberEats`
        )
        queryClient.invalidateQueries(['orders'])
        queryClient.invalidateQueries(['orderStats'])
        queryClient.invalidateQueries(['dashboard'])
        window.setTimeout(() => setSyncProgress(null), 900)
      },
      onError: (error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to sync orders'
        toast.error(message)
        setSyncProgress(null)
      }
    }
  )

  // Fetch orders from database
  const { data: ordersData, isLoading: ordersLoading } = useQuery(
    ['orders'],
    async () => {
      const response = await apiClient.get<{ orders: any[] }>(`/api/orders`)
      const orders = response.orders as any[]
      return orders.map((o) => ({
        ...o,
        total_amount: typeof o.total_amount === 'string' ? parseFloat(o.total_amount) : o.total_amount,
      })) as UberEatsOrder[]
    },
    {
      enabled: true
    }
  )

  // Fetch order stats
  const { data: statsData, isLoading: statsLoading } = useQuery(
    ['orderStats'],
    async () => {
      const response = await apiClient.get<{ stats: any }>('/api/orders/stats')
      const stats = response?.stats || null
      if (!stats) return null
      return {
        total_orders: typeof stats.total_orders === 'string' ? parseInt(stats.total_orders, 10) : stats.total_orders,
        total_spent: typeof stats.total_spent === 'string' ? parseFloat(stats.total_spent) : stats.total_spent,
        avg_order_value: typeof stats.avg_order_value === 'string' ? parseFloat(stats.avg_order_value) : stats.avg_order_value,
        unique_restaurants: typeof stats.unique_restaurants === 'string' ? parseInt(stats.unique_restaurants, 10) : stats.unique_restaurants,
        order_days: typeof stats.order_days === 'string' ? parseInt(stats.order_days, 10) : stats.order_days,
      } as OrderStats
    },
    {
      enabled: true
    }
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const calculateItemTotal = (item: OrderItem) => {
    let total = item.price || 0
    
    // Add customization prices
    if (item.customizations && item.customizations.length > 0) {
      item.customizations.forEach(customization => {
        if (customization.childOptions && customization.childOptions.options) {
          customization.childOptions.options.forEach(option => {
            total += option.price || 0
          })
        }
      })
    }
    
    return total * (item.quantity || 1)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getOrderTime = (order: UberEatsOrder | Order) => {
    // If it's a processed order from database
    if ('order_time' in order) {
      return order.order_time
    }
    
    // If it's a raw UberEats order
    const uberOrder = order as UberEatsOrder
    const orderData = uberOrder.baseEaterOrder || uberOrder
    if ('completedAt' in orderData) {
      return orderData.completedAt || orderData.created_at || ''
    }
    return orderData.created_at || uberOrder.created_at || ''
  }

  const getOrderItems = (order: UberEatsOrder | Order) => {
    // If it's a processed order from database
    if ('items' in order && order.items) {
      if (Array.isArray(order.items)) {
        return order.items.map((item: OrderItem) => item.title || item.name).join(', ')
      }
      return 'Items available'
    }
    
    // If it's a raw UberEats order
    const uberOrder = order as UberEatsOrder
    const orderData = uberOrder.baseEaterOrder || uberOrder
    if ('shoppingCart' in orderData && orderData.shoppingCart && orderData.shoppingCart.items) {
      return orderData.shoppingCart.items.map(item => item.title).join(', ')
    } else if (uberOrder.items) {
      return uberOrder.items.map((item: OrderItem) => item.title || item.name).join(', ')
    }
    return 'No items available'
  }

  const getOrderTotal = (order: UberEatsOrder) => {
    return (order.fareInfo?.totalPrice || 0) / 100.0
  }

  const getRestaurantName = (order: UberEatsOrder | Order) => {
    // If it's a processed order from database
    if ('restaurant_name' in order) {
      return order.restaurant_name
    }
    
    // If it's a raw UberEats order
    const uberOrder = order as UberEatsOrder
    
    console.log('Getting restaurant name for order:', uberOrder.uuid)
    console.log('Root storeInfo:', uberOrder.storeInfo)
    console.log('BaseEaterOrder storeInfo:', uberOrder.baseEaterOrder?.storeInfo)
    
    // Check for storeInfo at root level first (according to schema)
    if (uberOrder.storeInfo && uberOrder.storeInfo.title) {
      console.log('Using root storeInfo.title:', uberOrder.storeInfo.title)
      return uberOrder.storeInfo.title
    }
    
    // Fallback to baseEaterOrder data
    const orderData = uberOrder.baseEaterOrder || uberOrder
    if (orderData.storeInfo && orderData.storeInfo.title) {
      console.log('Using baseEaterOrder storeInfo.title:', orderData.storeInfo.title)
      return orderData.storeInfo.title
    }
    
    // Fallback to old format
    if (uberOrder.restaurant) {
      console.log('Using restaurant.name:', uberOrder.restaurant.name)
      return uberOrder.restaurant.name
    }
    
    console.log('No restaurant name found, using default')
    return 'Unknown Restaurant'
  }

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const isOrderExpanded = (orderId: string) => {
    return expandedOrders.has(orderId)
  }

  const FareBreakdown = ({ fareInfo }: { fareInfo: Order['fare_info'] }) => {
    if (!fareInfo || !fareInfo.checkoutInfo) {
      return null
    }

    const getItemValue = (item: any) => {
      let value = item.rawValue

      if (item.key === 'eats.mp.charges.basket_dependent_fee') {
        const serviceFee = fareInfo.checkoutInfo.find(info => info.key === 'delivery.uber.service_fee')
        value += serviceFee?.rawValue || 0
      }

      return formatCurrency(Math.abs(value))
    };

    const fareItems = fareInfo.checkoutInfo.filter(item => item.key !== 'delivery.uber.service_fee')

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Price Breakdown</h4>
        <div className="space-y-2">
          {fareItems.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{item.label}</span>
              <span className={`font-medium ${
                item.type === 'debit' ? 'text-green-600' : 'text-gray-900'
              }`}>
                {item.type === 'debit' ? '-' : ''}{getItemValue(item)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-bold text-lg text-gray-900">
              {formatCurrency(fareInfo.totalPrice / 100)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const RestaurantDetails = ({ restaurantDetails }: { restaurantDetails: Order['restaurant_details'] | any }) => {
    if (!restaurantDetails) {
      return null
    }

    const formatAddress = (address: any) => {
      return `${address.address1}, ${address.city}, ${address.region} ${address.postalCode}`;
    };

    const getRatingStars = (rating: boolean[]) => {
      if (!rating || rating.length === 0) return null;
      const filledStars = rating.filter(star => star).length;
      return (
        <div className="flex items-center space-x-1">
          {[...Array(5)].map((_, i) => (
            <StarIcon 
              key={i} 
              className={`h-4 w-4 ${i < filledStars ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
            />
          ))}
          <span className="text-sm text-gray-600 ml-1">({filledStars}/5)</span>
        </div>
      );
    };

    // Handle both 'name' and 'title' fields for restaurant name
    const restaurantName = restaurantDetails.name || restaurantDetails.title || 'Unknown Restaurant';

    return (
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-900 mb-3">Restaurant Details</h4>
        
        {restaurantDetails.heroImageUrl && (
          <div className="mb-3">
            <img 
              src={restaurantDetails.heroImageUrl} 
              alt={restaurantName}
              className="w-full h-32 object-cover rounded-lg"
            />
          </div>
        )}
        
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <h5 className="font-medium text-blue-900">{restaurantName}</h5>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              restaurantDetails.isOpen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {restaurantDetails.isOpen ? 'Open' : 'Closed'}
            </span>
          </div>
          
          {restaurantDetails.location && (
            <div className="flex items-start space-x-2 text-sm">
              <MapPinIcon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{formatAddress(restaurantDetails.location.address)}</span>
            </div>
          )}
          
          {restaurantDetails.contact?.phoneNumber && (
            <div className="flex items-center space-x-2 text-sm">
              <PhoneIcon className="h-4 w-4 text-blue-600" />
              <span className="text-gray-700">{restaurantDetails.contact.phoneNumber}</span>
            </div>
          )}
          
          {restaurantDetails.rating && getRatingStars(restaurantDetails.rating)}
          
          <div className="text-xs text-gray-500">
            <span className="font-medium">Slug:</span> {restaurantDetails.slug}
          </div>
        </div>
      </div>
    )
  }

  const OrderLineItems = ({ order }: { order: UberEatsOrder | Order }) => {
    let items: OrderItem[] = []
    
    // If it's a processed order from database
    if ('items' in order && order.items) {
      if (Array.isArray(order.items)) {
        items = order.items
      }
    } else {
      // If it's a raw UberEats order
      const uberOrder = order as UberEatsOrder
      const orderData = uberOrder.baseEaterOrder || uberOrder
      if ('shoppingCart' in orderData && orderData.shoppingCart && orderData.shoppingCart.items) {
        items = orderData.shoppingCart.items
      } else if (uberOrder.items) {
        items = uberOrder.items
      }
    }

    if (items.length === 0) {
      return (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Order Items</h4>
          <p className="text-sm text-gray-500">No items available for this order</p>
        </div>
      )
    }

    return (
      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
        <h4 className="text-sm font-medium text-green-900 mb-3">Order Items</h4>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`${item.title || item.name}-${index}`} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
              <div className="flex-1">
                <h5 className="font-medium text-gray-900">{item.title || item.name}</h5>
                {item.specialInstructions && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Special Instructions:</span> {item.specialInstructions}
                  </p>
                )}
                {item.customizations && item.customizations.length > 0 && (
                  <div className="mt-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Customizations:</span>
                    </p>
                    <ul className="text-sm text-gray-500 ml-4 mt-1 space-y-1">
                      {item.customizations.map((customization: Customization, idx: number) => (
                        <li key={`customization-${index}-${idx}`} className="list-disc">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-700">{customization.title}</span>
                            {customization.childOptions.options.map((option, optionIdx) => (
                              <div key={optionIdx} className="ml-2 text-gray-600">
                                <span className="text-sm">
                                  {option.title}
                                  {option.price > 0 && (
                                    <span className="text-green-600 ml-1">
                                      (+{formatCurrency(option.price / 100)})
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="text-right ml-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Qty: {item.quantity || 1}</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(calculateItemTotal(item) / 100)}
                  </span>
                </div>
                {item.quantity && item.quantity > 1 && (
                  <p className="text-xs text-gray-500">
                    {formatCurrency(calculateItemTotal(item) / (item.quantity * 100))} each
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-green-200">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-green-900">Items Total</span>
            <span className="font-bold text-lg text-green-900">
              {formatCurrency(items.reduce((sum, item) => sum + calculateItemTotal(item), 0) / 100)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (ordersLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
          <p className="text-gray-600">Your UberEats order history and analytics</p>
        </div>
        <button
          onClick={() => syncOrdersMutation.mutate()}
          disabled={syncOrdersMutation.isLoading}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${syncOrdersMutation.isLoading ? 'animate-spin' : ''}`} />
          {syncOrdersMutation.isLoading ? 'Syncing...' : 'Sync from UberEats'}
        </button>
      </div>

      {syncProgress !== null && (
        <div className="rounded-lg border border-primary-200 bg-primary-50/80 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-primary-900">
            <span className="font-medium">
              {syncOrdersMutation.isLoading
                ? 'Fetching full order history…'
                : syncProgress.percent >= 100
                  ? 'Sync complete'
                  : 'Sync finished'}
            </span>
            <span className="text-primary-800">
              {syncProgress.page > 0 ? `Page ${syncProgress.page}` : 'Starting…'}
              {syncProgress.cumulative > 0 ? ` · ${syncProgress.cumulative} orders` : null}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-primary-100">
            <div
              className="h-full rounded-full bg-primary-600 transition-[width] duration-300 ease-out"
              style={{ width: `${syncProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Auto-loading message */}
      {ordersLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <ArrowPathIcon className="h-4 w-4 text-blue-600 animate-spin" />
            <span className="text-blue-800 font-medium">Loading your orders from UberEats...</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-blue-500">
                <ShoppingBagIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.total_orders}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-green-500">
                <CurrencyDollarIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(statsData.total_spent)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-purple-500">
                <CurrencyDollarIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(statsData.avg_order_value)}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-yellow-500">
                <ShoppingBagIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Restaurants</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.unique_restaurants}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {ordersData && ordersData.length === 0 && !ordersLoading && (
        <div className="card text-center py-12">
          <ShoppingBagIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-600 mb-4">You don't have any orders in your history yet.</p>
        </div>
      )}

      {/* Fetched Orders from UberEats */}
      {ordersData && ordersData.length > 0 && (
        <div className="card border-2 border-blue-200 bg-blue-50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <EyeIcon className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-blue-900">Fetched Orders from UberEats</h2>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {ordersData.length} orders
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {ordersData.map((order, index) => (
              <div
                key={order.uuid}
                className="bg-white rounded-lg border border-blue-200"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <ShoppingBagIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{getRestaurantName(order)}</h3>
                        <p className="text-sm text-gray-500">{getOrderItems(order)}</p>
                      </div>
                    </div>
                  </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(getOrderTotal(order))}</p>
                        <p className="text-sm text-gray-500">{formatDate(getOrderTime(order))}</p>
                      </div>
                      
                      <div className="flex space-x-1">
                        <button
                          onClick={() => toggleOrderExpansion('fetched-' + (order.uuid || index))}
                          className="p-1 rounded-full hover:bg-blue-100 transition-colors"
                          title="View order details"
                        >
                          {isOrderExpanded('fetched-' + (order.uuid || index)) ? (
                            <ChevronUpIcon className="h-4 w-4 text-blue-600" />
                          ) : (
                            <ChevronDownIcon className="h-4 w-4 text-blue-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {isOrderExpanded('fetched-' + (order.uuid || index)) && (
                    <div className="space-y-4">
                      <RestaurantDetails restaurantDetails={order.storeInfo} />
                      <FareBreakdown fareInfo={order.fareInfo} />
                      <OrderLineItems order={order} />
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  )
}
