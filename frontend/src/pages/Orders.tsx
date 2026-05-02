import { useState, useEffect, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Dialog, Transition } from '@headlessui/react'
import { apiClient } from '../lib/apiClient'
import {
  ShoppingBagIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  BuildingStorefrontIcon,
  XMarkIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import StatCard from '../components/StatCard'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../components/ui/table'
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


function resolveStoreForDetails(order: UberEatsOrder | Order) {
  const o = order as UberEatsOrder & Order
  return o.storeInfo ?? o.restaurant_details ?? o.baseEaterOrder?.storeInfo
}

function resolveFareForBreakdown(order: UberEatsOrder | Order) {
  const o = order as UberEatsOrder & Order
  return o.fareInfo ?? o.fare_info ?? o.baseEaterOrder?.fareInfo
}

function getOrderTime(order: UberEatsOrder | Order) {
  if ('order_time' in order) {
    return order.order_time
  }
  const uberOrder = order as UberEatsOrder
  const orderData = uberOrder.baseEaterOrder || uberOrder
  if ('completedAt' in orderData) {
    return orderData.completedAt || orderData.created_at || ''
  }
  return orderData.created_at || uberOrder.created_at || ''
}

function getOrderItemsSummary(order: UberEatsOrder | Order) {
  if ('items' in order && order.items) {
    if (Array.isArray(order.items)) {
      return order.items.map((item: OrderItem) => item.title || item.name).join(', ')
    }
    return 'Items available'
  }
  const uberOrder = order as UberEatsOrder
  const orderData = uberOrder.baseEaterOrder || uberOrder
  if ('shoppingCart' in orderData && orderData.shoppingCart && orderData.shoppingCart.items) {
    return orderData.shoppingCart.items.map((item) => item.title).join(', ')
  }
  if (uberOrder.items) {
    return uberOrder.items.map((item: OrderItem) => item.title || item.name).join(', ')
  }
  return 'No items available'
}

function getOrderTotalCents(order: UberEatsOrder) {
  const fare = order.fareInfo ?? order.baseEaterOrder?.fareInfo
  return (fare?.totalPrice || 0) / 100.0
}

function getDisplayOrderTotal(order: UberEatsOrder | Order) {
  if ('total_amount' in order && order.total_amount != null) {
    return typeof order.total_amount === 'string'
      ? parseFloat(order.total_amount)
      : order.total_amount
  }
  return getOrderTotalCents(order as UberEatsOrder)
}

function getRestaurantName(order: UberEatsOrder | Order) {
  if ('restaurant_name' in order) {
    return order.restaurant_name
  }
  const uberOrder = order as UberEatsOrder
  if (uberOrder.storeInfo?.title) {
    return uberOrder.storeInfo.title
  }
  const orderData = uberOrder.baseEaterOrder || uberOrder
  if (orderData.storeInfo?.title) {
    return orderData.storeInfo.title
  }
  if (uberOrder.restaurant) {
    return uberOrder.restaurant.name
  }
  return 'Unknown Restaurant'
}

function getOrderRowKey(order: UberEatsOrder | Order, index: number) {
  const u = (order as UberEatsOrder).uuid
  if (u) return String(u)
  if ('id' in order && order.id) return String(order.id)
  return `order-${index}`
}

type OrdersTableSortField = 'restaurant' | 'date' | 'total'

const formatInteger = (n: number) => n.toLocaleString('en-US')

export default function Orders() {
  const [detailOrder, setDetailOrder] = useState<UberEatsOrder | Order | null>(null)
  const [ordersFilter, setOrdersFilter] = useState('')
  const [sortField, setSortField] = useState<OrdersTableSortField>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersPageSize, setOrdersPageSize] = useState(10)
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
      if (!window.desktop?.syncOrdersFull) {
        throw new Error('Order sync requires the desktop app.')
      }
      const res = await window.desktop.syncOrdersFull()
      if (!res.ok) {
        throw new Error(res.error?.message || 'Failed to sync orders')
      }
      return res.data
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)

  const orderStatCards = statsData
    ? [
        {
          name: 'Total orders',
          value: formatInteger(statsData.total_orders),
          icon: ShoppingBagIcon,
          iconClass: 'text-primary-600 dark:text-primary-400'
        },
        {
          name: 'Total spent',
          value: formatCurrency(statsData.total_spent),
          icon: CurrencyDollarIcon,
          iconClass: 'text-warning-600 dark:text-warning-400'
        },
        {
          name: 'Avg order value',
          value: formatCurrency(statsData.avg_order_value),
          icon: ChartBarIcon,
          iconClass: 'text-success-600 dark:text-success-400'
        },
        {
          name: 'Restaurants',
          value: formatInteger(statsData.unique_restaurants),
          icon: BuildingStorefrontIcon,
          iconClass: 'text-secondary-600 dark:text-secondary-400'
        }
      ]
    : []

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

  const handleOrdersSort = (field: OrdersTableSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'restaurant' ? 'asc' : 'desc')
    }
  }

  const filteredSortedOrders = useMemo(() => {
    if (!ordersData?.length) return []
    const q = ordersFilter.trim().toLowerCase()
    const rows = ordersData.filter((order) => {
      if (!q) return true
      const name = getRestaurantName(order).toLowerCase()
      const items = getOrderItemsSummary(order).toLowerCase()
      const id = String(
        (order as UberEatsOrder).uuid ?? ('id' in order && order.id ? order.id : '')
      ).toLowerCase()
      return name.includes(q) || items.includes(q) || id.includes(q)
    })
    return [...rows].sort((a, b) => {
      let cmp = 0
      if (sortField === 'restaurant') {
        cmp = getRestaurantName(a).localeCompare(getRestaurantName(b), undefined, {
          sensitivity: 'base'
        })
      } else if (sortField === 'date') {
        const ta = new Date(getOrderTime(a)).getTime()
        const tb = new Date(getOrderTime(b)).getTime()
        cmp = (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb)
      } else {
        cmp = getDisplayOrderTotal(a) - getDisplayOrderTotal(b)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [ordersData, ordersFilter, sortField, sortDir])

  useEffect(() => {
    setOrdersPage(1)
  }, [ordersFilter, sortField, sortDir, ordersPageSize])

  const ordersTotalPages = Math.max(1, Math.ceil(filteredSortedOrders.length / ordersPageSize))

  useEffect(() => {
    if (ordersPage > ordersTotalPages) {
      setOrdersPage(ordersTotalPages)
    }
  }, [ordersPage, ordersTotalPages])

  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersPageSize
    return filteredSortedOrders.slice(start, start + ordersPageSize)
  }, [filteredSortedOrders, ordersPage, ordersPageSize])

  const ordersRangeStart =
    filteredSortedOrders.length === 0 ? 0 : (ordersPage - 1) * ordersPageSize + 1
  const ordersRangeEnd = Math.min(ordersPage * ordersPageSize, filteredSortedOrders.length)

  const SortHeaderButton = ({
    field,
    label,
    className = ''
  }: {
    field: OrdersTableSortField
    label: string
    className?: string
  }) => (
    <button
      type="button"
      onClick={() => handleOrdersSort(field)}
      className={`group inline-flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white ${className}`}
    >
      <span>{label}</span>
      {sortField === field ? (
        sortDir === 'asc' ? (
          <ChevronUpIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
        ) : (
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-primary-600" aria-hidden />
        )
      ) : (
        <ChevronUpDownIcon
          className="h-4 w-4 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-600"
          aria-hidden
        />
      )}
    </button>
  )

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
          <h1 className="text-title-sm font-bold text-gray-900 dark:text-white/90">Order History</h1>
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

      {/* Stats Cards — layout matches Dashboard */}
      {orderStatCards.length > 0 && (
        <div className="grid grid-cols-4 gap-6">
          {orderStatCards.map((stat) => (
            <StatCard
              key={stat.name}
              label={stat.name}
              value={stat.value}
              icon={stat.icon}
              iconClass={stat.iconClass}
            />
          ))}
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
        <div className="space-y-4">
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="relative max-w-md min-w-[200px] flex-1">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <input
                type="search"
                value={ordersFilter}
                onChange={(e) => setOrdersFilter(e.target.value)}
                placeholder="Filter by restaurant, items, or order ID…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                aria-label="Filter orders"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <span className="whitespace-nowrap">Rows per page</span>
              <select
                value={ordersPageSize}
                onChange={(e) => setOrdersPageSize(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-sm dark:border-white/[0.05] dark:bg-white/[0.03]">
            {filteredSortedOrders.length === 0 ? (
              <p className="p-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                No orders match your filter. Try a different search.
              </p>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-5 py-3 text-start font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        <SortHeaderButton field="restaurant" label="Restaurant" className="justify-start" />
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="min-w-[12rem] px-5 py-3 text-start font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        Items
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-5 py-3 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        <span className="inline-flex w-full justify-end">
                          <SortHeaderButton field="total" label="Total" className="justify-end" />
                        </span>
                      </TableCell>
                      <TableCell
                        isHeader
                        scope="col"
                        className="px-5 py-3 text-end font-medium text-theme-xs text-gray-500 dark:text-gray-400"
                      >
                        <span className="inline-flex w-full justify-end">
                          <SortHeaderButton field="date" label="Date" className="justify-end" />
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order, rowIdx) => {
                      const absIdx = (ordersPage - 1) * ordersPageSize + rowIdx
                      return (
                        <TableRow
                          key={getOrderRowKey(order, absIdx)}
                          className="cursor-pointer transition-colors hover:bg-gray-50 focus-within:bg-gray-50 dark:hover:bg-white/[0.02] dark:focus-within:bg-white/[0.02]"
                          onClick={() => setDetailOrder(order)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setDetailOrder(order)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View details for order from ${getRestaurantName(order)}`}
                        >
                          <TableCell className="px-6 py-4 text-start">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                <ShoppingBagIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" aria-hidden />
                              </div>
                              <span className="font-medium text-theme-sm text-gray-800 dark:text-white/90">
                                {getRestaurantName(order)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                            <span className="line-clamp-2" title={getOrderItemsSummary(order)}>
                              {getOrderItemsSummary(order)}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-5 py-4 text-end text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                            {formatCurrency(getDisplayOrderTotal(order))}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-5 py-4 text-end text-theme-sm text-gray-500 dark:text-gray-400">
                            {formatDate(getOrderTime(order))}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {filteredSortedOrders.length > 0 && (
            <div className="flex flex-row items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-white/[0.05]">
              <p className="text-theme-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium text-gray-900 dark:text-white/90">{ordersRangeStart}</span>–
                <span className="font-medium text-gray-900 dark:text-white/90">{ordersRangeEnd}</span> of{' '}
                <span className="font-medium text-gray-900 dark:text-white/90">{filteredSortedOrders.length}</span>
                {ordersFilter.trim() ? (
                  <span className="text-gray-500 dark:text-gray-500"> (of {ordersData.length} loaded)</span>
                ) : null}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                  disabled={ordersPage <= 1}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                <span className="px-2 text-theme-sm text-gray-600 dark:text-gray-400">
                  Page {ordersPage} of {ordersTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                  disabled={ordersPage >= ordersTotalPages}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Transition.Root show={detailOrder !== null} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setDetailOrder(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500/40 backdrop-blur-[1px]" aria-hidden="true" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/5 transition-all">
                  {detailOrder ? (
                    <>
                      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
                        <div className="min-w-0">
                          <Dialog.Title className="text-lg font-semibold text-gray-900">
                            {getRestaurantName(detailOrder)}
                          </Dialog.Title>
                          <p className="mt-1 text-sm text-gray-500">
                            {formatDate(getOrderTime(detailOrder))}
                            <span className="text-gray-400"> · </span>
                            {formatCurrency(getDisplayOrderTotal(detailOrder))}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          onClick={() => setDetailOrder(null)}
                          aria-label="Close order details"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto px-6 py-4">
                        <RestaurantDetails
                          restaurantDetails={resolveStoreForDetails(detailOrder)}
                        />
                        <FareBreakdown fareInfo={resolveFareForBreakdown(detailOrder)} />
                        <OrderLineItems order={detailOrder} />
                      </div>
                    </>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  )
}
