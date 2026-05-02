export {}

export type OrdersBackgroundRefreshEndPayload = {
  updated: boolean
  newCount?: number
  pages?: number
  error?: string
}

export type OrdersSyncProgressPayload =
  | {
      type: 'progress'
      page: number
      batchSize: number
      cumulativeOrders: number
      percent: number
    }
  | {
      type: 'complete'
      pages?: number
      cumulativeOrders?: number
      percent: number
    }
  | {
      type: 'error'
      message: string
      status?: number
    }

declare global {
  interface Window {
    desktop?: {
      getVersion: () => Promise<string>
      request: (
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        body?: unknown
      ) => Promise<{
        ok: boolean
        data?: any
        error?: {
          message: string
          status: number
        }
      }>
      loginUberEats?: () => Promise<
        | {
            ok: true
            data?: {
              message?: string
              connected?: boolean
              createdAt?: string
            }
          }
        | {
            ok: false
            error?: {
              message: string
            }
          }
      >
      syncOrdersFull?: () => Promise<{
        ok: boolean
        data?: {
          message?: string
          syncedCount?: number
          pages?: number
          syncedAt?: string
        }
        error?: {
          message: string
          status: number
        }
      }>
      onOrdersSyncProgress?: (callback: (payload: OrdersSyncProgressPayload) => void) => () => void
      onOrdersBackgroundRefreshStart?: (callback: () => void) => () => void
      onOrdersBackgroundRefreshEnd?: (callback: (payload: OrdersBackgroundRefreshEndPayload) => void) => () => void
      onUberProfileUpdated?: (callback: () => void) => () => void
    }
  }
}
