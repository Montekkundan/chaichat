"use client"

import { useState, useMemo } from "react"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { MessageContentSkeleton } from "./message-content-skeleton"
import { useCache } from "~/lib/providers/cache-provider"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { Message } from "~/db"

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
  const cache = useCache()
  
  // Only use convexId if it exists - don't fallback to AI SDK messageId
  // AI SDK generates IDs like "msg-..." which are not valid Convex IDs
  const actualConvexId = convexId
  
  // Get all versions of this message using Convex query
  // Only run query if we have a valid Convex ID
  const versions = useQuery(
    api.chat.getMessageVersions,
    actualConvexId ? { messageId: actualConvexId as Id<"messages"> } : "skip"
  )
  
  const switchVersionMutation = useMutation(api.chat.switchMessageVersion)
  
  // Find the current active version index - memoize to prevent recalculation
  const currentVersionIndex = useMemo(() => {
    if (!versions || versions.length === 0) return 0
    const activeIndex = versions.findIndex((v) => v.isActive)
    return activeIndex !== -1 ? activeIndex : 0
  }, [versions])
  
  // If there's only one version or no valid convex ID, just render the children
  if (!actualConvexId || !versions || versions.length <= 1) {
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
          await switchVersionMutation({ messageId: versionToActivate._id })
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
          await switchVersionMutation({ messageId: versionToActivate._id })
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