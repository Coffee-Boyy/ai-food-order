import { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  // Get the first available session
  const { data: sessionData, error } = useQuery(
    ['session'],
    async () => {
      const response = await axios.get('/api/auth/session')
      return response.data
    },
    {
      retry: 3,
      retryDelay: 1000,
      onSuccess: (data) => {
        setUser(data.user)
        setSessionToken(data.sessionToken)
        localStorage.setItem('sessionToken', data.sessionToken)
        setLoading(false)
      },
      onError: (error) => {
        console.error('Failed to get session:', error)
        setUser(null)
        setSessionToken(null)
        localStorage.removeItem('sessionToken')
        setLoading(false)
      }
    }
  )

  // Verify session on mount if we have a stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('sessionToken')
    if (storedToken && !sessionToken) {
      setSessionToken(storedToken)
    }
  }, [sessionToken])

  return {
    user,
    loading,
    sessionToken,
    isAuthenticated: !!user,
    error
  }
}
