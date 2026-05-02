import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import {
  ChartBarIcon,
  ClockIcon,
  CalendarIcon,
  SparklesIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowPathIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import { MODEL_STATUS_MESSAGES } from '../lib/recommendationModelStatus'
import toast from 'react-hot-toast'

/** API shape for a stored order recommendation (wire format retains legacy field names). */
interface OrderRecommendation {
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
  revision_of?: string
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const timeOptions = [
  { value: 'breakfast', label: 'Breakfast (6 AM - 11 AM)' },
  { value: 'lunch', label: 'Lunch (11 AM - 4 PM)' },
  { value: 'dinner', label: 'Dinner (4 PM - 10 PM)' },
  { value: 'late_night', label: 'Late Night (10 PM - 6 AM)' }
]

export default function Recommendations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const [selectedTime, setSelectedTime] = useState('lunch')

  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery(
    ['recommendations'],
    async () => {
      const response = await apiClient.get<{ predictions: OrderRecommendation[] }>('/api/predictions')
      return response.predictions as OrderRecommendation[]
    },
    {
      enabled: !!user
    }
  )

  const { data: accuracyData, isLoading: accuracyLoading } = useQuery(
    ['recommendationAccuracy'],
    async () => {
      const response = await apiClient.get<{ accuracy: any }>('/api/predictions/accuracy')
      return response.accuracy
    },
    {
      enabled: !!user
    }
  )

  const [modelStatusError, setModelStatusError] = useState<{ title: string; detail: string } | null>(null)

  const notifyRecommendationRequestError = (error: any, fallbackMessage: string) => {
    const message: string = error?.message || ''
    const knownCode = Object.keys(MODEL_STATUS_MESSAGES).find((code) =>
      message.toLowerCase().includes(code.toLowerCase())
    )
    if (knownCode) {
      setModelStatusError(MODEL_STATUS_MESSAGES[knownCode])
    } else {
      setModelStatusError(null)
      toast.error(message || fallbackMessage)
    }
  }

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
        toast.success('Recommendation generated successfully!')
        queryClient.invalidateQueries(['recommendations'])
        queryClient.invalidateQueries(['recommendationAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: (error: any) => {
        notifyRecommendationRequestError(error, 'Failed to generate recommendation')
      }
    }
  )

  const reviseMutation = useMutation(
    async (recommendationId: string) => {
      return apiClient.post('/api/predictions/revise', { predictionId: recommendationId })
    },
    {
      onSuccess: () => {
        setModelStatusError(null)
        toast.success('New recommendation generated!')
        queryClient.invalidateQueries(['recommendations'])
        queryClient.invalidateQueries(['recommendationAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: (error: any) => {
        notifyRecommendationRequestError(error, 'Failed to generate a new recommendation')
      }
    }
  )

  const feedbackMutation = useMutation(
    async ({ recommendationId, isCorrect }: { recommendationId: string; isCorrect: boolean }) => {
      await apiClient.post('/api/predictions/feedback', {
        predictionId: recommendationId,
        isCorrect
      })
    },
    {
      onSuccess: () => {
        toast.success('Feedback submitted!')
        queryClient.invalidateQueries(['recommendations'])
        queryClient.invalidateQueries(['recommendationAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: () => {
        toast.error('Failed to submit feedback')
      }
    }
  )

  const handleGenerateRecommendation = () => {
    generateMutation.mutate()
  }

  const handleFeedback = (recommendationId: string, isCorrect: boolean) => {
    feedbackMutation.mutate({ recommendationId, isCorrect })
  }

  const handleRevise = (recommendationId: string) => {
    reviseMutation.mutate(recommendationId)
  }

  const deleteMutation = useMutation(
    async (recommendationId: string) => {
      return apiClient.delete<{ success: boolean }>(
        `/api/predictions/${encodeURIComponent(recommendationId)}`
      )
    },
    {
      onSuccess: () => {
        toast.success('Recommendation removed')
        queryClient.invalidateQueries(['recommendations'])
        queryClient.invalidateQueries(['recommendationAccuracy'])
        queryClient.invalidateQueries(['dashboard'])
      },
      onError: (error: any) => {
        toast.error(error?.message || 'Failed to delete recommendation')
      }
    }
  )

  const handleDeleteRecommendation = (recommendationId: string) => {
    if (!window.confirm('Delete this recommendation? This cannot be undone.')) return
    deleteMutation.mutate(recommendationId)
  }

  const recommendationActionPending =
    generateMutation.isLoading || reviseMutation.isLoading || deleteMutation.isLoading

  if (recommendationsLoading || accuracyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI order recommendations</h1>
        <p className="text-gray-600">Get personalized suggestions based on your order history</p>
      </div>

      {modelStatusError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-800">{modelStatusError.title}</p>
          <p className="mt-1 text-sm text-amber-700">{modelStatusError.detail}</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Generate a new recommendation</h2>
          <SparklesIcon className="h-6 w-6 text-primary-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
          onClick={handleGenerateRecommendation}
          disabled={recommendationActionPending}
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          <SparklesIcon className="h-4 w-4" />
          <span>
            {generateMutation.isLoading ? 'Generating recommendation…' : 'Generate recommendation'}
          </span>
        </button>
      </div>

      {accuracyData && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recommendation feedback</h2>
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {accuracyData.total_predictions || 0}
              </p>
              <p className="text-sm text-gray-600">Total recommendations</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {accuracyData.correct_predictions || 0}
              </p>
              <p className="text-sm text-gray-600">Marked helpful</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {accuracyData.accuracy_percentage || 0}%
              </p>
              <p className="text-sm text-gray-600">Helpful rate</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent recommendations</h2>
          <ChartBarIcon className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          {recommendationsData && recommendationsData.length > 0 ? (
            recommendationsData.map((recommendation) => (
              <div
                key={recommendation.id}
                className="p-4 bg-gray-50 rounded-lg"
              >
                <div className="mb-3">
                  <h3 className="font-medium text-gray-900">{recommendation.predicted_restaurant}</h3>
                  <p className="text-sm text-gray-500">
                    {dayNames[recommendation.day_of_week]} • {recommendation.time_of_day}
                  </p>
                  {recommendation.revision_of ? (
                    <p className="mt-0.5 text-xs text-gray-500">Follow-up recommendation</p>
                  ) : null}
                </div>

                <div className="mb-2">
                  <p className="text-sm text-gray-600">
                    <strong>Suggested items:</strong> {recommendation.predicted_items.join(', ')}
                  </p>
                </div>

                {recommendation.reasoning && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 italic">{recommendation.reasoning}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {new Date(recommendation.created_at).toLocaleDateString()}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRevise(recommendation.id)}
                      disabled={recommendationActionPending || feedbackMutation.isLoading}
                      className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      aria-label="Generate another recommendation"
                      title="Generate another recommendation"
                    >
                      <ArrowPathIcon
                        className={`h-5 w-5 ${reviseMutation.isLoading && reviseMutation.variables === recommendation.id ? 'animate-spin' : ''}`}
                        aria-hidden
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteRecommendation(recommendation.id)}
                      disabled={recommendationActionPending || feedbackMutation.isLoading}
                      className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      aria-label="Delete recommendation"
                      title="Delete recommendation"
                    >
                      <TrashIcon
                        className={`h-5 w-5 ${deleteMutation.isLoading && deleteMutation.variables === recommendation.id ? 'opacity-50' : ''}`}
                        aria-hidden
                      />
                    </button>

                    {recommendation.is_correct === undefined && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleFeedback(recommendation.id, true)}
                          className="rounded-lg border border-gray-200 p-2 text-green-600 transition-colors hover:border-green-300 hover:bg-green-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                          aria-label="Mark recommendation as helpful"
                          title="Helpful"
                        >
                          <HandThumbUpIcon className="h-5 w-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(recommendation.id, false)}
                          className="rounded-lg border border-gray-200 p-2 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                          aria-label="Mark recommendation as not helpful"
                          title="Not helpful"
                        >
                          <HandThumbDownIcon className="h-5 w-5" aria-hidden />
                        </button>
                      </>
                    )}

                    {recommendation.is_correct !== undefined && (
                      <div
                        className={`flex items-center gap-1.5 ${recommendation.is_correct ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {recommendation.is_correct ? (
                          <>
                            <HandThumbUpIcon className="h-5 w-5 shrink-0" aria-hidden />
                            <span className="text-sm">Marked as helpful</span>
                          </>
                        ) : (
                          <>
                            <HandThumbDownIcon className="h-5 w-5 shrink-0" aria-hidden />
                            <span className="text-sm">Marked as not helpful</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations yet</h3>
              <p className="text-gray-500 mb-4">
                Generate your first recommendation to see AI-powered suggestions for what to order
              </p>
              <button
                onClick={handleGenerateRecommendation}
                disabled={recommendationActionPending}
                className="btn-primary"
              >
                {generateMutation.isLoading ? 'Generating…' : 'Generate first recommendation'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
