import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import {
  ChartBarIcon,
  ClockIcon,
  CalendarIcon,
  SparklesIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import { MODEL_STATUS_MESSAGES } from '../lib/predictionModelStatus'
import toast from 'react-hot-toast'

interface Prediction {
  id: string
  predicted_restaurant: string
  predicted_items: string[]
  confidence_score: number
  day_of_week: number
  time_of_day: string
  created_at: string
  is_correct?: boolean
  reasoning?: string
  source?: string
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const timeOptions = [
  { value: 'breakfast', label: 'Breakfast (6 AM - 11 AM)' },
  { value: 'lunch', label: 'Lunch (11 AM - 4 PM)' },
  { value: 'dinner', label: 'Dinner (4 PM - 10 PM)' },
  { value: 'late_night', label: 'Late Night (10 PM - 6 AM)' }
]

export default function Predictions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const [selectedTime, setSelectedTime] = useState('lunch')

  // Fetch predictions
  const { data: predictionsData, isLoading: predictionsLoading } = useQuery(
    ['predictions'],
    async () => {
      const response = await apiClient.get<{ predictions: Prediction[] }>('/api/predictions')
      return response.predictions as Prediction[]
    },
    {
      enabled: !!user
    }
  )

  // Fetch prediction accuracy
  const { data: accuracyData, isLoading: accuracyLoading } = useQuery(
    ['predictionAccuracy'],
    async () => {
      const response = await apiClient.get<{ accuracy: any }>('/api/predictions/accuracy')
      return response.accuracy
    },
    {
      enabled: !!user
    }
  )

  const [modelStatusError, setModelStatusError] = useState<{ title: string; detail: string } | null>(null)

  // Generate prediction mutation
  const generateMutation = useMutation(
    async () => {
      return apiClient.post('/api/predictions/generate', {
        dayOfWeek: selectedDay,
        timeOfDay: selectedTime
      })
    },
    {
      onSuccess: () => {
        setModelStatusError(null)
        toast.success('Prediction generated successfully!')
        queryClient.invalidateQueries(['predictions'])
        queryClient.invalidateQueries(['predictionAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: (error: any) => {
        const message: string = error?.message || ''
        // Look for a known model-status code embedded in the error message
        const knownCode = Object.keys(MODEL_STATUS_MESSAGES).find((code) =>
          message.toLowerCase().includes(code.toLowerCase())
        )
        if (knownCode) {
          setModelStatusError(MODEL_STATUS_MESSAGES[knownCode])
        } else {
          setModelStatusError(null)
          toast.error(message || 'Failed to generate prediction')
        }
      }
    }
  )

  // Feedback mutation
  const feedbackMutation = useMutation(
    async ({ predictionId, isCorrect }: { predictionId: string; isCorrect: boolean }) => {
      await apiClient.post('/api/predictions/feedback', {
        predictionId,
        isCorrect
      })
    },
    {
      onSuccess: () => {
        toast.success('Feedback submitted!')
        queryClient.invalidateQueries(['predictions'])
        queryClient.invalidateQueries(['predictionAccuracy'])
      },
      onError: () => {
        toast.error('Failed to submit feedback')
      }
    }
  )

  const handleGeneratePrediction = () => {
    generateMutation.mutate()
  }

  const handleFeedback = (predictionId: string, isCorrect: boolean) => {
    feedbackMutation.mutate({ predictionId, isCorrect })
  }

  if (predictionsLoading || accuracyLoading) {
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
        <h1 className="text-2xl font-bold text-gray-900">AI Predictions</h1>
        <p className="text-gray-600">Get AI-powered food recommendations based on your order history</p>
      </div>

      {/* Model status error banner */}
      {modelStatusError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-800">{modelStatusError.title}</p>
          <p className="mt-1 text-sm text-amber-700">{modelStatusError.detail}</p>
        </div>
      )}

      {/* Prediction Generator */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Generate New Prediction</h2>
          <SparklesIcon className="h-6 w-6 text-primary-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Day Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="h-4 w-4 inline mr-1" />
              Day of Week
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="input-field"
            >
              {dayNames.map((day, index) => (
                <option key={index} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <ClockIcon className="h-4 w-4 inline mr-1" />
              Time of Day
            </label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="input-field"
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleGeneratePrediction}
          disabled={generateMutation.isLoading}
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          <SparklesIcon className="h-4 w-4" />
          <span>
            {generateMutation.isLoading ? 'Generating Prediction...' : 'Generate Prediction'}
          </span>
        </button>
      </div>

      {/* Accuracy Stats */}
      {accuracyData && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Prediction Accuracy</h2>
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {accuracyData.total_predictions || 0}
              </p>
              <p className="text-sm text-gray-600">Total Predictions</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {accuracyData.correct_predictions || 0}
              </p>
              <p className="text-sm text-gray-600">Correct Predictions</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {accuracyData.accuracy_percentage || 0}%
              </p>
              <p className="text-sm text-gray-600">Accuracy Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Predictions */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Predictions</h2>
          <ChartBarIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          {predictionsData && predictionsData.length > 0 ? (
            predictionsData.map((prediction) => (
              <div
                key={prediction.id}
                className="p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{prediction.predicted_restaurant}</h3>
                    <p className="text-sm text-gray-500">
                      {dayNames[prediction.day_of_week]} • {prediction.time_of_day}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      {(prediction.confidence_score * 100).toFixed(0)}% confidence
                    </span>
                    {prediction.source === 'apple-foundation-models' && (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <svg className="h-3 w-3" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                            <path d="M7 0a7 7 0 1 0 0 14A7 7 0 0 0 7 0zm.75 10.5h-1.5v-4h1.5v4zm0-5.5h-1.5V3.5h1.5V5z"/>
                          </svg>
                          On-device
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-2">
                  <p className="text-sm text-gray-600">
                    <strong>Recommended items:</strong> {prediction.predicted_items.join(', ')}
                  </p>
                </div>

                {prediction.reasoning && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 italic">{prediction.reasoning}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {new Date(prediction.created_at).toLocaleDateString()}
                  </p>

                  {/* Feedback buttons */}
                  {prediction.is_correct === undefined && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleFeedback(prediction.id, true)}
                        className="flex items-center space-x-1 text-green-600 hover:text-green-700 text-sm"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>Correct</span>
                      </button>
                      <button
                        onClick={() => handleFeedback(prediction.id, false)}
                        className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm"
                      >
                        <XCircleIcon className="h-4 w-4" />
                        <span>Incorrect</span>
                      </button>
                    </div>
                  )}

                  {/* Feedback status */}
                  {prediction.is_correct !== undefined && (
                    <div className="flex items-center space-x-1">
                      {prediction.is_correct ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">Marked as correct</span>
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-600">Marked as incorrect</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No predictions yet</h3>
              <p className="text-gray-500 mb-4">
                Generate your first prediction to see AI-powered food recommendations
              </p>
              <button
                onClick={handleGeneratePrediction}
                disabled={generateMutation.isLoading}
                className="btn-primary"
              >
                {generateMutation.isLoading ? 'Generating...' : 'Generate First Prediction'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
