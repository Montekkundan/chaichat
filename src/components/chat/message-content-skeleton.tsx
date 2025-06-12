import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"

type MessageContentSkeletonProps = {
  className?: string
}

export function MessageContentSkeleton({ className }: MessageContentSkeletonProps) {
  return (
    <div
      className={cn(
        "prose dark:prose-invert relative min-w-full bg-transparent p-0",
        "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto",
        className
      )}
    >
      <div className="space-y-3">
        {/* First line - longer */}
        <Skeleton className="h-4 w-full" />
        
        {/* Second line - medium */}
        <Skeleton className="h-4 w-3/4" />
        
        {/* Third line - shorter */}
        <Skeleton className="h-4 w-1/2" />
        
        {/* Fourth line - medium */}
        <Skeleton className="h-4 w-2/3" />
        
        {/* Last line - short */}
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
} 