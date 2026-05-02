import { createContext, useContext, useState, type ReactNode } from 'react'

type SidebarContextType = {
  isExpanded: boolean
  isHovered: boolean
  toggleSidebar: () => void
  setIsHovered: (isHovered: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  const toggleSidebar = () => setIsExpanded((prev) => !prev)

  return (
    <SidebarContext.Provider
      value={{
        isExpanded,
        isHovered,
        toggleSidebar,
        setIsHovered
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}
