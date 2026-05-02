import { useSidebar } from '../context/SidebarContext'
import { ThemeToggleButton } from './ThemeToggleButton'
import { useAuth } from '../hooks/useAuth'

export default function AppHeader() {
  const { toggleSidebar } = useSidebar()
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-99999 w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex w-full grow items-center justify-between gap-4 px-6 py-4">
        <button
          type="button"
          className="z-99999 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
              fill="currentColor"
            />
          </svg>
        </button>

        <div className="relative flex min-w-0 flex-1 justify-center">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
            <svg
              className="fill-gray-500 dark:fill-gray-400"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                fill=""
              />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search or type command..."
            className="h-11 w-full max-w-[430px] rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-primary-300 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-primary-700"
            readOnly
            aria-label="Search (placeholder)"
            title="Search coming soon"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs tracking-tight text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
            <span>⌘</span>
            <span>K</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggleButton />
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-200 dark:border-gray-700">
              {user?.pictureUrl ? (
                <img src={user.pictureUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary-100 text-theme-sm font-medium text-primary-800 dark:bg-primary-500/15 dark:text-primary-200">
                  {(user?.firstName?.[0] ?? '?').toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-theme-sm font-medium text-gray-900 dark:text-white/90">
                {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account'}
              </p>
              {user?.email?.trim() ? (
                <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">{user.email.trim()}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
