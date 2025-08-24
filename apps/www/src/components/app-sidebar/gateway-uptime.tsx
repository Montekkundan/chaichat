"use client"

import { useState, useEffect } from "react"
import { Badge } from "~/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { Database, Server } from "lucide-react"
import { useCache } from "~/lib/providers/cache-provider"

import type { HealthData } from "~/lib/providers/cache-provider"

interface GatewayUptimeProps {
  endpoint?: string
  className?: string
}

export function GatewayUptime({ endpoint = "/api/health", className = "" }: GatewayUptimeProps) {
  const { getHealthData } = useCache()
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchHealth = async () => {
      const data = await getHealthData(endpoint)
      if (mounted) setHealthData(data)
      if (mounted) setLoading(false)
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 60000)
    return () => { mounted = false; clearInterval(interval) }
  }, [endpoint, getHealthData])

  if (loading) {
    return (
      <div className={`flex items-center gap-x-4 py-2 ${className}`}>
        <div className="flex gap-2 items-center">
          <div className="animate-pulse bg-muted rounded h-3.5 w-3.5" />
          <div className="animate-pulse bg-muted rounded h-3 w-8" />
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex gap-1 items-center">
            <div className="animate-pulse bg-muted rounded-full h-2 w-2" />
            <div className="animate-pulse bg-muted rounded-full h-2 w-2" />
          </div>

          <div className="animate-pulse bg-muted rounded-full h-5 w-16" />
        </div>
      </div>
    )
  }

  const isOperational =
    healthData?.health?.status === "ok" &&
    healthData?.health?.redis?.connected &&
    healthData?.health?.database?.connected

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-x-4 py-2 ${className}`}>
        {/* Left: Service info */}
        <div className="flex gap-2 items-center">
          <svg
            role="img"
            aria-label="LLM Gateway"
            fill="none"
            className="h-3.5 w-3.5 text-muted-foreground"
            viewBox="0 0 218 232"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M218 59.4686c0-4.1697-2.351-7.9813-6.071-9.8441L119.973 3.58361s2.926 3.32316 2.926 7.01529V218.833c0 4.081-2.926 7.016-2.926 7.016l15.24-7.468c2.964-2.232 7.187-7.443 7.438-16.006.293-9.976.61-84.847.732-121.0353.487-3.6678 4.096-11.0032 14.63-11.0032 10.535 0 29.262 5.1348 37.309 7.7022 2.439.7336 7.608 4.1812 8.779 12.1036 1.17 7.9223.975 59.0507.731 83.6247 0 2.445.137 7.069 6.653 7.069 6.515 0 6.515-7.069 6.515-7.069V59.4686Z"
              fill="currentColor"
            />
            <path
              d="M149.235 86.323c0-5.5921 5.132-9.7668 10.589-8.6132l31.457 6.6495c4.061.8585 6.967 4.4207 6.967 8.5824v81.9253c0 5.868 5.121 9.169 5.121 9.169l-51.9-12.658c-1.311-.32-2.234-1.498-2.234-2.852V86.323ZM99.7535 1.15076c7.2925-3.60996 15.8305 1.71119 15.8305 9.86634V220.983c0 8.155-8.538 13.476-15.8305 9.866L6.11596 184.496C2.37105 182.642 0 178.818 0 174.63v-17.868l49.7128 19.865c4.0474 1.617 8.4447-1.372 8.4449-5.741 0-2.66-1.6975-5.022-4.2142-5.863L0 146.992v-14.305l40.2756 7.708c3.9656.759 7.6405-2.289 7.6405-6.337 0-3.286-2.4628-6.048-5.7195-6.413L0 122.917V108.48l78.5181-3.014c4.1532-.16 7.4381-3.582 7.4383-7.7498 0-4.6256-4.0122-8.2229-8.5964-7.7073L0 98.7098V82.4399l53.447-17.8738c2.3764-.7948 3.9791-3.0254 3.9792-5.5374 0-4.0961-4.0978-6.9185-7.9106-5.4486L0 72.6695V57.3696c.0000304-4.1878 2.37107-8.0125 6.11596-9.8664L99.7535 1.15076Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-xs font-medium text-muted-foreground">Health</span>
        </div>

        {/* Right: Status indicators */}
        <div className="flex gap-2 items-center">
          {/* Individual service status */}
          <div className="flex gap-1 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`h-2 w-2 rounded-full ${healthData?.health?.database?.connected ? "bg-emerald-500" : "bg-red-500"}`}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Database: {healthData?.health?.database?.connected ? "Connected" : "Disconnected"}
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`h-2 w-2 rounded-full ${healthData?.health?.redis?.connected ? "bg-emerald-500" : "bg-red-500"}`}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  Redis: {healthData?.health?.redis?.connected ? "Connected" : "Disconnected"}
                </div>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Overall status badge */}
          <Badge
            variant={isOperational ? "default" : "destructive"}
            className={`h-5 px-2 text-xs ${isOperational ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
          >
            {isOperational ? "Operational" : "Issues"}
          </Badge>
        </div>
      </div>
    </TooltipProvider>
  )
}
