import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/apiClient'
import {
  ChartBarIcon,
  SparklesIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowPathIcon,
  TrashIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '../components/LoadingSpinner'
import RecommendationWhenPicker from '../components/RecommendationWhenPicker'
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

const timeOfDayLabel: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  late_night: 'Late night'
}

const timeOfDayChipClass: Record<string, string> = {
  breakfast:
    'bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50',
  lunch: 'bg-sky-50 text-sky-800 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/50',
  dinner:
    'bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900/50',
  late_night:
    'bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-slate-700'
}

function confidencePercent(score: number): number | null {
  if (typeof score !== 'number' || Number.isNaN(score)) return null
  if (score >= 0 && score <= 1) return Math.round(score * 100)
  if (score > 1 && score <= 100) return Math.round(score)
  return Math.min(100, Math.max(0, Math.round(score)))
}

function formatCreatedAt(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch {
    return iso
  }
}

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface RecentRecommendationCardProps {
  recommendation: OrderRecommendation
  recommendationActionPending: boolean
  feedbackMutationLoading: boolean
  isRevisePending: boolean
  isDeletePending: boolean
  onRevise: (id: string) => void
  onDelete: (id: string) => void
  onFeedback: (id: string, isCorrect: boolean) => void
}

function RecentRecommendationCard({
  recommendation,
  recommendationActionPending,
  feedbackMutationLoading,
  isRevisePending,
  isDeletePending,
  onRevise,
  onDelete,
  onFeedback
}: RecentRecommendationCardProps) {
  const pct = confidencePercent(recommendation.confidence_score)
  const whenChip =
    timeOfDayChipClass[recommendation.time_of_day] ??
    'bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
  const actionsDisabled = recommendationActionPending || feedbackMutationLoading

  const accentOpacity = pct !== null ? 0.45 + (pct / 100) * 0.55 : 0.9
  const primaryWashOpacity = pct !== null ? 0.06 + (pct / 100) * 0.14 : 0

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-gray-200/90 bg-linear-to-br from-white via-white to-primary-25/40 shadow-theme-sm ring-1 ring-black/[0.03] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-theme-md dark:border-gray-800 dark:from-gray-900/90 dark:via-gray-900/70 dark:to-primary-950/30 dark:ring-white/[0.06]">
      {pct !== null ? (
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-transparent via-transparent to-primary-500 dark:to-primary-600"
          style={{ opacity: primaryWashOpacity }}
          aria-hidden
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1 bg-linear-to-b from-primary-400 via-primary-500 to-primary-600"
        style={{ opacity: accentOpacity }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 p-4 pl-5 sm:flex-row sm:items-start sm:gap-5 sm:p-5 sm:pl-6">
        <div className="flex shrink-0 items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary-100 to-primary-50 text-sm font-semibold tracking-tight text-primary-800 shadow-inner ring-1 ring-primary-200/80 dark:from-primary-900/50 dark:to-primary-950/40 dark:text-primary-200 dark:ring-primary-800/60"
            aria-hidden
          >
            {restaurantInitials(recommendation.predicted_restaurant)}
          </div>
          <div className="min-w-0 flex-1 sm:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-gray-900">
                {recommendation.predicted_restaurant}
              </h3>
              {recommendation.revision_of ? (
                <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-theme-xs font-medium text-primary-700 ring-1 ring-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-500/25">
                  Follow-up
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="hidden sm:block">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">
                {recommendation.predicted_restaurant}
              </h3>
              {recommendation.revision_of ? (
                <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-theme-xs font-medium text-primary-700 ring-1 ring-primary-100 dark:bg-primary-500/15 dark:text-primary-300 dark:ring-primary-500/25">
                  Follow-up
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-theme-sm text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-1 ring-1 ring-gray-100 dark:bg-gray-800/80 dark:ring-gray-700">
              <CalendarDaysIcon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-500" aria-hidden />
              {dayNames[recommendation.day_of_week]}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 ring-1 ${whenChip}`}
            >
              <ClockIcon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {timeOfDayLabel[recommendation.time_of_day] ?? recommendation.time_of_day}
            </span>
            {pct !== null ? (
              <span
                className="inline-flex items-center rounded-lg bg-primary-50 px-2 py-1 text-theme-xs font-semibold tabular-nums text-primary-800 ring-1 ring-primary-100 dark:bg-primary-500/12 dark:text-primary-200 dark:ring-primary-500/25"
                title="Model confidence"
              >
                {pct}%
              </span>
            ) : null}
            {recommendation.source ? (
              <span className="text-theme-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {recommendation.source}
              </span>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-500">
              Suggested items
            </p>
            <ul className="flex flex-wrap gap-2">
              {recommendation.predicted_items.length > 0 ? (
                recommendation.predicted_items.map((item, idx) => (
                  <li key={`${recommendation.id}-item-${idx}`}>
                    <span className="inline-flex max-w-full rounded-full border border-gray-200 bg-white px-3 py-1 text-theme-sm text-gray-800 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-100">
                      <span className="truncate" title={item}>
                        {item}
                      </span>
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-theme-sm text-gray-500 italic">No items listed</li>
              )}
            </ul>
          </div>

          {recommendation.reasoning ? (
            <div className="relative rounded-xl border border-gray-200/80 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <ChatBubbleLeftRightIcon
                className="absolute right-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500"
                aria-hidden
              />
              <p className="pr-6 text-theme-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {recommendation.reasoning}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-theme-xs text-gray-500 dark:text-gray-500">
              <time dateTime={recommendation.created_at}>{formatCreatedAt(recommendation.created_at)}</time>
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="mr-auto flex items-center sm:mr-0">
                {recommendation.is_correct === undefined ? (
                  <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-500">
                    Was this helpful?
                  </span>
                ) : recommendation.is_correct ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-theme-xs font-medium text-success-700 ring-1 ring-success-100 dark:bg-success-950/35 dark:text-success-400 dark:ring-success-800/50">
                    <HandThumbUpIcon className="h-4 w-4 shrink-0" aria-hidden />
                    Helpful
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-error-50 px-2.5 py-1 text-theme-xs font-medium text-error-700 ring-1 ring-error-100 dark:bg-error-950/35 dark:text-error-400 dark:ring-error-800/50">
                    <HandThumbDownIcon className="h-4 w-4 shrink-0" aria-hidden />
                    Not helpful
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => onRevise(recommendation.id)}
                disabled={actionsDisabled}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-2 text-gray-600 shadow-theme-xs transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-600 dark:hover:bg-primary-950/40 dark:hover:text-primary-300 dark:focus-visible:ring-offset-gray-900"
                aria-label="Generate another recommendation"
                title="Generate another recommendation"
              >
                <ArrowPathIcon
                  className={`h-5 w-5 ${isRevisePending ? 'animate-spin' : ''}`}
                  aria-hidden
                />
              </button>

              <button
                type="button"
                onClick={() => onDelete(recommendation.id)}
                disabled={actionsDisabled}
                className="cursor-pointer rounded-xl border border-gray-200 bg-white p-2 text-gray-600 shadow-theme-xs transition-all hover:border-error-300 hover:bg-error-50 hover:text-error-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-error-600 dark:hover:bg-error-950/30 dark:focus-visible:ring-offset-gray-900"
                aria-label="Delete recommendation"
                title="Delete recommendation"
              >
                <TrashIcon className={`h-5 w-5 ${isDeletePending ? 'opacity-50' : ''}`} aria-hidden />
              </button>

              {recommendation.is_correct === undefined ? (
                <>
                  <button
                    type="button"
                    onClick={() => onFeedback(recommendation.id, true)}
                    className="cursor-pointer rounded-xl border border-success-200 bg-success-50 p-2 text-success-700 shadow-theme-xs transition-all hover:border-success-400 hover:bg-success-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-success-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-success-800 dark:bg-success-950/30 dark:text-success-400 dark:hover:bg-success-950/50 dark:focus-visible:ring-offset-gray-900"
                    disabled={actionsDisabled}
                    aria-label="Mark recommendation as helpful"
                    title="Helpful"
                  >
                    <HandThumbUpIcon className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => onFeedback(recommendation.id, false)}
                    className="cursor-pointer rounded-xl border border-error-200 bg-error-50 p-2 text-error-700 shadow-theme-xs transition-all hover:border-error-400 hover:bg-error-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-error-800 dark:bg-error-950/30 dark:text-error-400 dark:hover:bg-error-950/50 dark:focus-visible:ring-offset-gray-900"
                    disabled={actionsDisabled}
                    aria-label="Mark recommendation as not helpful"
                    title="Not helpful"
                  >
                    <HandThumbDownIcon className="h-5 w-5" aria-hidden />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

/** Same buckets as RecommendationWhenPicker & API (local clock). */
function getInitialTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 16) return 'lunch'
  if (hour >= 16 && hour < 22) return 'dinner'
  return 'late_night'
}

export default function Recommendations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay())
  const [selectedTime, setSelectedTime] = useState(() => getInitialTimeOfDay())

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

        <RecommendationWhenPicker
          selectedDay={selectedDay}
          selectedTime={selectedTime}
          onDayChange={setSelectedDay}
          onTimeChange={setSelectedTime}
        />

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

          <div className="grid grid-cols-3 gap-4">
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
              <RecentRecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                recommendationActionPending={recommendationActionPending}
                feedbackMutationLoading={feedbackMutation.isLoading}
                isRevisePending={
                  reviseMutation.isLoading && reviseMutation.variables === recommendation.id
                }
                isDeletePending={
                  deleteMutation.isLoading && deleteMutation.variables === recommendation.id
                }
                onRevise={handleRevise}
                onDelete={handleDeleteRecommendation}
                onFeedback={handleFeedback}
              />
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
