import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import { motion } from 'framer-motion'
import {
  UserIcon,
  CogIcon,
  ShieldCheckIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  preferences: any
  created_at: string
}

export default function Settings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [cookieHeader, setCookieHeader] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  })

  // Fetch user profile
  const { data: profileData, isLoading } = useQuery(
    ['userProfile'],
    async () => {
      const response = await apiClient.get<{ user: UserProfile }>('/api/users/profile')
      return response.user as UserProfile
    },
    {
      enabled: !!user,
      onSuccess: (data) => {
        setFormData({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || ''
        })
      }
    }
  )

  // Update profile mutation
  const updateProfileMutation = useMutation(
    async (data: typeof formData) => {
      return apiClient.put('/api/users/profile', {
        firstName: data.firstName,
        lastName: data.lastName
      })
    },
    {
      onSuccess: () => {
        toast.success('Profile updated successfully!')
        setIsEditing(false)
        queryClient.invalidateQueries(['userProfile'])
      },
      onError: () => {
        toast.error('Failed to update profile')
      }
    }
  )

  // Delete account mutation
  const deleteAccountMutation = useMutation(
    async () => {
      await apiClient.delete('/api/users/account')
    },
    {
      onSuccess: () => {
        toast.success('Account deleted successfully')
        // Refresh the page to show the no session message
        window.location.reload()
      },
      onError: () => {
        toast.error('Failed to delete account')
      }
    }
  )

  const { data: uberConnection } = useQuery(
    ['uberConnection'],
    async () => {
      const response = await apiClient.get<{
        connected: boolean
        lastImportedAt: string | null
        lastSyncAt: string | null
      }>('/api/uber/session/status')
      return response
    },
    {
      enabled: !!user
    }
  )

  const connectUberMutation = useMutation(
    async (rawCookie: string) => {
      return apiClient.post('/api/uber/session/import', {
        cookieHeader: rawCookie
      })
    },
    {
      onSuccess: () => {
        toast.success('UberEats session connected')
        setCookieHeader('')
        queryClient.invalidateQueries(['uberConnection'])
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.message || 'Failed to connect UberEats session')
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
        queryClient.invalidateQueries(['uberConnection'])
      },
      onError: () => {
        toast.error('Failed to disconnect UberEats session')
      }
    }
  )

  const handleSave = () => {
    updateProfileMutation.mutate(formData)
  }

  const handleCancel = () => {
    setFormData({
      firstName: profileData?.firstName || '',
      lastName: profileData?.lastName || '',
      email: profileData?.email || ''
    })
    setIsEditing(false)
  }

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      deleteAccountMutation.mutate()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account and preferences</p>
      </div>

      {/* Profile Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          <UserIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                disabled={!isEditing}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                disabled={!isEditing}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              disabled
              className="input-field bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateProfileMutation.isLoading}
                className="btn-primary"
              >
                {updateProfileMutation.isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-primary"
            >
              Edit Profile
            </button>
          )}
        </div>
      </motion.div>

      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="card"
      >
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
      </motion.div>

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">UberEats Connection</h3>
              <p className="text-sm text-gray-500">
                {uberConnection?.connected
                  ? 'Connected to your UberEats account'
                  : 'Not connected. Paste a session cookie to link your account.'}
              </p>
              {uberConnection?.lastImportedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Connected: {new Date(uberConnection.lastImportedAt).toLocaleString()}
                </p>
              )}
              {uberConnection?.lastSyncAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Last sync: {new Date(uberConnection.lastSyncAt).toLocaleString()}
                </p>
              )}
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                uberConnection?.connected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {uberConnection?.connected ? 'Connected' : 'Not Connected'}
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
                disabled={disconnectUberMutation.isLoading || !uberConnection?.connected}
                className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
            <p className="text-xs text-gray-500">
              For Electron, this same endpoint can be called automatically after in-app login to avoid manual paste.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Last Login</h3>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="card border-red-200 bg-red-50"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
          <TrashIcon className="h-5 w-5 text-red-400" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-red-100 rounded-lg">
            <div>
              <h3 className="font-medium text-red-900">Delete Account</h3>
              <p className="text-sm text-red-700">
                Permanently delete your account and all associated data
              </p>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteAccountMutation.isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50"
            >
              {deleteAccountMutation.isLoading ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
