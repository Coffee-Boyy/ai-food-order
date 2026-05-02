import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import toast, { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { ThemeProvider } from './hooks/useTheme.tsx'
import './index.css'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

async function bootstrap() {
  let ordersStartupRefreshToastId: string | undefined

  window.desktop?.onOrdersBackgroundRefreshStart?.(() => {
    if (ordersStartupRefreshToastId !== undefined) {
      toast.dismiss(ordersStartupRefreshToastId)
    }
    ordersStartupRefreshToastId = toast.loading('Updating orders from UberEats…', {
      duration: Infinity,
    })
  })

  window.desktop?.onOrdersBackgroundRefreshEnd?.((payload) => {
    if (ordersStartupRefreshToastId !== undefined) {
      toast.dismiss(ordersStartupRefreshToastId)
      ordersStartupRefreshToastId = undefined
    }
    if (payload?.error) {
      toast.error(`Could not refresh orders: ${payload.error}`)
      return
    }
    if (payload?.updated) {
      queryClient.invalidateQueries(['orders'])
      queryClient.invalidateQueries(['orderStats'])
      queryClient.invalidateQueries(['dashboard'])
      queryClient.invalidateQueries(['session'])
      const n = payload.newCount ?? 0
      if (n > 0) {
        toast.success(
          `Synced ${n} new order${n === 1 ? '' : 's'} from UberEats`,
          { duration: 4000 }
        )
      }
    }
  })

  window.desktop?.onUberProfileUpdated?.(() => {
    queryClient.invalidateQueries(['session'])
  })

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

bootstrap()
