import { ClockIcon, MoonIcon, SparklesIcon, SunIcon } from '@heroicons/react/24/outline'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const DAY_NAMES_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const

/** Monday-first column order; values are API day indices (Sunday = 0). */
const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

const TIME_SLOTS = [
  {
    value: 'breakfast',
    short: 'Brk',
    title: 'Breakfast',
    range: '6am – 11am',
    Icon: SunIcon
  },
  {
    value: 'lunch',
    short: 'Lunch',
    title: 'Lunch',
    range: '11am – 4pm',
    Icon: ClockIcon
  },
  {
    value: 'dinner',
    short: 'Din',
    title: 'Dinner',
    range: '4pm – 10pm',
    Icon: MoonIcon
  },
  {
    value: 'late_night',
    short: 'Late',
    title: 'Late night',
    range: '10pm – 6am',
    Icon: SparklesIcon
  }
] as const

type Props = {
  selectedDay: number
  selectedTime: string
  onDayChange: (day: number) => void
  onTimeChange: (time: string) => void
}

/** Each weekday column is one card: day label + four time slots inside the same control. */
export default function RecommendationWhenPicker({
  selectedDay,
  selectedTime,
  onDayChange,
  onTimeChange
}: Props) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-theme-sm font-medium text-gray-700 dark:text-gray-300">Day &amp; time</p>
      <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-white/[0.02]">
        <fieldset>
          <legend className="sr-only">
            Choose a time of day under the weekday you want — each tile sets both the day and the meal time
          </legend>

          <div className="grid grid-cols-7 gap-2">
            {WEEK_DISPLAY_ORDER.map((dayIndex) => {
              const label = DAY_LABELS[dayIndex]
              const dayActive = selectedDay === dayIndex
              return (
                <div
                  key={dayIndex}
                  className={`flex min-w-0 flex-col rounded-xl border-2 p-1.5 transition-colors ${
                    dayActive
                      ? 'border-primary-500 bg-white shadow-theme-sm ring-1 ring-primary-500/15 dark:bg-gray-900'
                      : 'border-gray-200/90 bg-white/60 dark:border-gray-600 dark:bg-gray-800/50'
                  }`}
                >
                  <div
                    className={`pointer-events-none mb-1.5 w-full rounded-lg py-1.5 text-center text-theme-sm font-semibold ${
                      dayActive
                        ? 'bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-200'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                    aria-hidden
                  >
                    {label}
                  </div>

                  <div
                    className="grid grid-cols-2 gap-1"
                    role="radiogroup"
                    aria-label={`Time of day for ${DAY_NAMES_FULL[dayIndex]}`}
                  >
                    {TIME_SLOTS.map(({ value, short, title, range, Icon }) => {
                      const slotActive = dayActive && selectedTime === value
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-label={`${DAY_NAMES_FULL[dayIndex]}, ${title}, ${range}`}
                          aria-checked={slotActive}
                          onClick={() => {
                            onDayChange(dayIndex)
                            onTimeChange(value)
                          }}
                          className={`flex min-h-[2.75rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ${
                            slotActive
                              ? 'border-primary-500 bg-primary-100 text-primary-900 dark:border-primary-400 dark:bg-primary-500/20 dark:text-primary-100'
                              : 'border-transparent bg-gray-100/90 text-gray-600 hover:border-gray-300 hover:bg-white dark:bg-gray-900/60 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-800'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="max-w-full truncate text-[10px] font-medium leading-none">
                            {short}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
