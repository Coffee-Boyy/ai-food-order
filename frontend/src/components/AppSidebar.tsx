import { Link, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSidebar } from '../context/SidebarContext'

type NavItem = {
  name: string
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Feed', href: '/feed', icon: BuildingStorefrontIcon },
  { name: 'Orders', href: '/orders', icon: ShoppingBagIcon },
  { name: 'Recommendations', href: '/recommendations', icon: ChartBarIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon }
]

export default function AppSidebar() {
  const { user } = useAuth()
  const location = useLocation()
  const { isExpanded, isHovered, isMobileOpen, setIsHovered } = useSidebar()

  const showLabels = isExpanded || isHovered || isMobileOpen

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 ${
        isExpanded || isMobileOpen ? 'w-[290px]' : isHovered ? 'w-[290px]' : 'w-[90px]'
      } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex py-8 ${!isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'}`}
      >
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-secondary-600 shadow-theme-sm">
            <span className="text-sm font-bold text-white">AI</span>
          </div>
          {showLabels ? (
            <span className="text-xl font-semibold text-gray-900 dark:text-white">Food Order</span>
          ) : null}
        </Link>
      </div>

      <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto">
        <nav className="mb-6">
          <h2
            className={`mb-4 flex text-xs font-medium uppercase leading-5 text-gray-400 ${
              !isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'
            }`}
          >
            {showLabels ? 'Menu' : <EllipsisHorizontalIcon className="size-6 opacity-70" />}
          </h2>
          <ul className="flex flex-col gap-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`menu-item group ${isActive ? 'menu-item-active' : 'menu-item-inactive'} ${
                      !isExpanded && !isHovered ? 'lg:justify-center' : 'lg:justify-start'
                    }`}
                  >
                    <item.icon
                      className={`size-6 shrink-0 ${
                        isActive ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
                      }`}
                      aria-hidden
                    />
                    {showLabels ? <span>{item.name}</span> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-gray-200 pt-6 dark:border-gray-800">
          <div
            className={`flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.03] ${
              !showLabels ? 'justify-center p-2' : ''
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 dark:bg-primary-500/15">
              {user?.pictureUrl ? (
                <img
                  src={user.pictureUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-theme-sm font-medium text-primary-700 dark:text-primary-300">
                  {(user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
                </span>
              )}
            </div>
            {showLabels ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-theme-sm font-medium text-gray-900 dark:text-white/90">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account'}
                </p>
                {user?.email?.trim() ? (
                  <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                    {user.email.trim()}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  )
}
