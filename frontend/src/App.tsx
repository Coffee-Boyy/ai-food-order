import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Feed from './pages/Feed'
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-xl bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            No Session Available
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Please use the CLI tool to create a session first
          </p>
          
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              How to get started:
            </h3>
            <div className="space-y-4 text-left">
              <div className="flex items-start space-x-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                  <span className="text-sm font-medium text-blue-600">1</span>
                </div>
                <span className="text-sm text-gray-700">Install and run the CLI tool</span>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                  <span className="text-sm font-medium text-blue-600">2</span>
                </div>
                <span className="text-sm text-gray-700">Authenticate with your UberEats account</span>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                  <span className="text-sm font-medium text-blue-600">3</span>
                </div>
                <span className="text-sm text-gray-700">Refresh this page to access the dashboard</span>
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
        <Route path="/feed" element={<Feed />} />
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
