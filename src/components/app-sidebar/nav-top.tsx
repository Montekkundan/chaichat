"use client"

import type { LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactElement } from "react"
import { isValidElement } from "react"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"

export function NavTop({
  items,
}: {
  items: {
    title: string
    url?: string
    onClick?: () => void
    icon?: LucideIcon | ReactElement
    activeIcon?: ReactElement
    isActive?: boolean
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          // Determine if this item is active based on pathname
          const isActive = item.title === "Home" ? pathname === "/" : item.isActive || false
          
          return (
            <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  tooltip={item.title}
                  onClick={item.onClick}
                  isActive={isActive}
                >
                  {item.icon && (
                    isActive && item.activeIcon ? (
                      item.activeIcon
                    ) : isValidElement(item.icon) ? (
                      item.icon
                    ) : typeof item.icon === 'function' ? (
                      <item.icon className="h-4 w-4" />
                    ) : null
                  )}
                  <span>{item.title}</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
