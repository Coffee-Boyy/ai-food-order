export {}

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
      onOrdersBackgroundRefresh?: (callback: () => void) => () => void
      onUberProfileUpdated?: (callback: () => void) => () => void
    }
  }
}
