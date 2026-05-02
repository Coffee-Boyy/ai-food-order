import { ReactNode } from 'react'
import { SidebarProvider, useSidebar } from '../context/SidebarContext'
import AppHeader from './AppHeader'
import AppSidebar from './AppSidebar'

interface LayoutProps {
  children: ReactNode
}

function LayoutMain({ children }: { children: ReactNode }) {
  const { isExpanded, isHovered } = useSidebar()

  return (
    <div
      className={`flex-1 transition-all duration-300 ease-in-out ${
        isExpanded || isHovered ? 'ml-[260px]' : 'ml-[80px]'
      }`}
    >
      <AppHeader />
      <div className="mx-auto max-w-screen-2xl p-6">{children}</div>
    </div>
  )
}

export default function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <LayoutMain>{children}</LayoutMain>
      </div>
    </SidebarProvider>
  )
}
