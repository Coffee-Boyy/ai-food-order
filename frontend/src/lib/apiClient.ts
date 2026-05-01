type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

class DesktopApiError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  if (!window.desktop?.request) {
    throw new DesktopApiError('Desktop services unavailable. Launch via Electron.', 503)
  }

  const response = await window.desktop.request(method, path, body)
  if (!response.ok) {
    throw new DesktopApiError(response.error?.message || 'Request failed', response.error?.status || 500)
  }

  return response.data as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path)
}
