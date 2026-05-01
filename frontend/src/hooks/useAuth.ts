import { useEffect } from 'react'
import { useQuery } from 'react-query'
import { apiClient } from '../lib/apiClient'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  pictureUrl?: string | null
}

export interface UberSessionInfo {
  connected: boolean
  lastImportedAt: string | null
  lastSyncAt: string | null
}

type SessionApiResponse = {
  user: User
  sessionToken: string | null
  uberConnected: boolean
  uberSession: UberSessionInfo
}

function uberFromSessionPayload(data: SessionApiResponse | undefined): UberSessionInfo | null {
  if (!data) return null
  if (data.uberSession) return data.uberSession
  return {
    connected: Boolean(data.uberConnected),
    lastImportedAt: null,
    lastSyncAt: null
  }
}

export function useAuth() {
  const { data: sessionData, isLoading, error, isError } = useQuery(
    ['session'],
    async () => apiClient.get<SessionApiResponse>('/api/auth/session'),
    {
      retry: 3,
      retryDelay: 1000
    }
  )

  const user = sessionData?.user ?? null
  const sessionToken = sessionData?.sessionToken ?? null
  const uberSession = uberFromSessionPayload(sessionData)

  useEffect(() => {
    if (sessionToken) {
      localStorage.setItem('sessionToken', sessionToken)
    } else {
      localStorage.removeItem('sessionToken')
    }
  }, [sessionToken])

  return {
    user,
    loading: isLoading,
    sessionToken,
    uberSession,
    isAuthenticated: !!user,
    error: isError ? error : undefined
  }
}
