import { Link, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  ShoppingBagIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
import { useSidebar } from '../context/SidebarContext'

type NavItem = {
  name: string
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Orders', href: '/orders', icon: ShoppingBagIcon },
  { name: 'Recommendations', href: '/recommendations', icon: ChartBarIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon }
]

export default function AppSidebar() {
  const location = useLocation()
  const { isExpanded, isHovered, setIsHovered } = useSidebar()

  const showLabels = isExpanded || isHovered

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 ${
        isExpanded || isHovered ? 'w-[260px]' : 'w-[80px]'
      }`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex py-8 ${!isExpanded && !isHovered ? 'justify-center' : 'justify-start'}`}
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
              !isExpanded && !isHovered ? 'justify-center' : 'justify-start'
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
                      !isExpanded && !isHovered ? 'justify-center' : 'justify-start'
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
      </div>
    </aside>
  )
}
