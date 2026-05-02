import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Recommendations from './pages/Recommendations'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import LoadingSpinner from './components/LoadingSpinner'

function App() {
  const { user, loading, error } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-error-500 to-error-700 shadow-theme-md mx-auto">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h2 className="text-title-sm font-bold text-gray-900 dark:text-white/90">No session available</h2>
          <p className="text-theme-xl text-gray-600 dark:text-gray-400">
            Launch this app with Electron (<span className="font-mono text-theme-sm">pnpm electron:dev</span>) and try again.
          </p>

          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-left shadow-theme-lg dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white/90">How to get started</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-theme-sm font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                  1
                </div>
                <span className="text-theme-sm text-gray-700 dark:text-gray-300">Run the desktop app from the project root</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-theme-sm font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                  2
                </div>
                <span className="text-theme-sm text-gray-700 dark:text-gray-300">Open Settings and connect your UberEats account</span>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-theme-sm font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                  3
                </div>
                <span className="text-theme-sm text-gray-700 dark:text-gray-300">Reload if the dashboard does not appear</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/predictions" element={<Navigate to="/recommendations" replace />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App
