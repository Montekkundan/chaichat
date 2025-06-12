"use client"

import { useState, useEffect, useMemo } from "react"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { MessageContentSkeleton } from "./message-content-skeleton"

type MessageVersionsProps = {
  messageId: string
  convexId?: string
  children: React.ReactNode
  className?: string
}

export function MessageVersions({ 
  messageId, 
  convexId,
  children, 
  className 
}: MessageVersionsProps) {
  const [isLoadingVersion, setIsLoadingVersion] = useState(false)
  
  const messageIdTyped = useMemo(() => (convexId || messageId) as Id<"messages">, [convexId, messageId])
  
  const versions = useQuery(
    api.chat.getMessageVersions,
    convexId ? { messageId: messageIdTyped } : "skip"
  )
  
  const switchVersion = useMutation(api.chat.switchMessageVersion)
  
  const currentVersionIndex = useMemo(() => {
    if (!versions || versions.length === 0) return 0
    const activeIndex = versions.findIndex(v => v.isActive)
    return activeIndex !== -1 ? activeIndex : 0
  }, [versions])
  
  if (!versions || versions.length <= 1) {
    return <div className={className}>{children}</div>
  }
  
  const currentVersion = versions[currentVersionIndex]
  const hasMultipleVersions = versions.length > 1
  
  const handlePrevious = async () => {
    if (currentVersionIndex > 0 && !isLoadingVersion) {
      const newIndex = currentVersionIndex - 1
      const versionToActivate = versions?.[newIndex]
      
      if (versionToActivate) {
        setIsLoadingVersion(true)
        
        try {
          await switchVersion({ messageId: versionToActivate._id })
          await new Promise(resolve => setTimeout(resolve, 150))
        } catch (error) {
          console.error("Failed to switch version:", error)
        } finally {
          setIsLoadingVersion(false)
        }
      }
    }
  }
  
  const handleNext = async () => {
    if (currentVersionIndex < (versions?.length || 0) - 1 && !isLoadingVersion) {
      const newIndex = currentVersionIndex + 1
      const versionToActivate = versions?.[newIndex]
      
      if (versionToActivate) {
        setIsLoadingVersion(true)
        
        try {
          await switchVersion({ messageId: versionToActivate._id })
          await new Promise(resolve => setTimeout(resolve, 150))
        } catch (error) {
          console.error("Failed to switch version:", error)
        } finally {
          setIsLoadingVersion(false)
        }
      }
    }
  }
  
  return (
    <div className={cn("relative", className)}>
      {hasMultipleVersions && (
        <div className="flex items-center gap-1 mb-2 opacity-70 hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handlePrevious}
            disabled={currentVersionIndex === 0 || isLoadingVersion}
          >
            <CaretLeft className="h-3 w-3" />
          </Button>
          
          <span className="text-xs text-muted-foreground px-2">
            {currentVersionIndex + 1} / {versions.length}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleNext}
            disabled={currentVersionIndex === versions.length - 1 || isLoadingVersion}
          >
            <CaretRight className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      <div className="transition-opacity duration-150">
        {isLoadingVersion ? (
          <MessageContentSkeleton />
        ) : (
          children
        )}
      </div>
    </div>
  )
} 