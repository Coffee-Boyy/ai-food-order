export {}

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
    }
  }
}
