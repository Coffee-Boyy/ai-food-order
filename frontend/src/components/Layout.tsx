import { ReactNode } from 'react'
import { SidebarProvider, useSidebar } from '../context/SidebarContext'
import AppHeader from './AppHeader'
import AppSidebar from './AppSidebar'
import Backdrop from './Backdrop'

interface LayoutProps {
  children: ReactNode
}

function LayoutMain({ children }: { children: ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()

  return (
    <div
      className={`flex-1 transition-all duration-300 ease-in-out ${
        isExpanded || isHovered ? 'lg:ml-[290px]' : 'lg:ml-[90px]'
      } ${isMobileOpen ? 'ml-0' : ''}`}
    >
      <AppHeader />
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6">{children}</div>
    </div>
  )
}

export default function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen xl:flex">
        <div>
          <AppSidebar />
          <Backdrop />
        </div>
        <LayoutMain>{children}</LayoutMain>
      </div>
    </SidebarProvider>
  )
}
