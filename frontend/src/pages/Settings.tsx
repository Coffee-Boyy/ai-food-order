import { useState } from 'react'
import { useMutation, useQueryClient } from 'react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import { CogIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export default function Settings() {
  const { uberSession } = useAuth()
  const queryClient = useQueryClient()
  const [cookieHeader, setCookieHeader] = useState('')

  const connectUberMutation = useMutation(
    async (rawCookie: string) => {
      return apiClient.post<{ message?: string; connected?: boolean; createdAt?: string }>(
        '/api/uber/session/import',
        {
          cookieHeader: rawCookie
        }
      )
    },
    {
      onSuccess: () => {
        toast.success('UberEats session connected')
        setCookieHeader('')
        void queryClient.invalidateQueries(['session'])
      },
      onError: (error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Failed to connect UberEats session'
        toast.error(message)
      }
    }
  )

  const disconnectUberMutation = useMutation(
    async () => {
      await apiClient.delete('/api/uber/session')
    },
    {
      onSuccess: () => {
        toast.success('UberEats session disconnected')
        void queryClient.invalidateQueries(['session'])
      },
      onError: () => {
        toast.error('Failed to disconnect UberEats session')
      }
    }
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
          <CogIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Email Notifications</h3>
              <p className="text-sm text-gray-500">Receive updates about new features and predictions</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Prediction Reminders</h3>
              <p className="text-sm text-gray-500">Get reminded about your predicted orders</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">UberEats Connection</h3>
              <p className="text-sm text-gray-500">
                {uberSession?.connected
                  ? 'Connected to your UberEats account'
                  : 'Not connected. Paste a session cookie to link your account.'}
              </p>
              {uberSession?.lastImportedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Connected: {new Date(uberSession.lastImportedAt).toLocaleString()}
                </p>
              )}
              {uberSession?.lastSyncAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Last sync: {new Date(uberSession.lastSyncAt).toLocaleString()}
                </p>
              )}
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                uberSession?.connected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {uberSession?.connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <label className="block text-sm font-medium text-gray-700">UberEats Cookie Header</label>
            <textarea
              value={cookieHeader}
              onChange={(e) => setCookieHeader(e.target.value)}
              placeholder="sid=...; csrf_token=...;"
              rows={3}
              className="input-field"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => connectUberMutation.mutate(cookieHeader)}
                disabled={!cookieHeader.trim() || connectUberMutation.isLoading}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
              >
                {connectUberMutation.isLoading ? 'Connecting...' : 'Connect Session'}
              </button>
              <button
                onClick={() => disconnectUberMutation.mutate()}
                disabled={disconnectUberMutation.isLoading || !uberSession?.connected}
                className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
