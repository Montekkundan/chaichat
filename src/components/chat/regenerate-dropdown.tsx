"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { cn } from "~/lib/utils"
import { MagnifyingGlass, ArrowClockwise } from "@phosphor-icons/react"
import { useState } from "react"
import type { ModelConfig } from "~/lib/models/types"
import { PROVIDERS } from "~/lib/providers"
import { FREE_MODELS_IDS } from "~/lib/config"
import { useModels } from "~/lib/providers/models-provider"

type RegenerateDropdownProps = {
  currentModel: string
  onRegenerate: (model: string) => void
  children: React.ReactNode
}

export function RegenerateDropdown({
  currentModel,
  onRegenerate,
  children,
}: RegenerateDropdownProps) {
  const { models, isLoading: isLoadingModels } = useModels()
  const [searchQuery, setSearchQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const filteredModels = models
    .filter((model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aIsFree = FREE_MODELS_IDS.includes(a.id)
      const bIsFree = FREE_MODELS_IDS.includes(b.id)
      return aIsFree === bIsFree ? 0 : aIsFree ? -1 : 1
    })

  const currentModelData = models.find((model) => model.id === currentModel)

  const handleRegenerate = (modelId: string) => {
    onRegenerate(modelId)
    setIsOpen(false)
    setSearchQuery("")
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80 max-h-96 overflow-hidden p-0" 
        align="end"
        side="top"
      >
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 mb-3">
            <ArrowClockwise className="size-4 text-muted-foreground" />
            <span className="font-medium text-sm">Regenerate Response</span>
          </div>
          
          {/* Current model retry button */}
          <button
            onClick={() => handleRegenerate(currentModel)}
            className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left"
            type="button"
          >
            <span className="text-sm text-muted-foreground">Retry with:</span>
            <span className="text-sm font-medium">{currentModelData?.name || currentModel}</span>
          </button>
        </div>

        <DropdownMenuSeparator />

        <div className="p-2">
          <div className="text-xs text-muted-foreground mb-2 px-2">
            Or try with a different model:
          </div>
          
          {/* Search */}
          <div className="relative mb-2">
            <MagnifyingGlass className="text-muted-foreground absolute top-2.5 left-2.5 h-3 w-3" />
            <Input
              placeholder="Search models..."
              className="pl-7 h-8 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Models list */}
          <div className="max-h-48 overflow-y-auto">
            {isLoadingModels ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                Loading models...
              </div>
            ) : filteredModels.length > 0 ? (
              filteredModels.map((model) => {
                const provider = PROVIDERS.find(
                  (provider) => provider.id === model.providerId
                )
                const isPro = !FREE_MODELS_IDS.includes(model.id)
                const isCurrentModel = model.id === currentModel

                return (
                  <DropdownMenuItem
                    key={model.id}
                    onClick={() => handleRegenerate(model.id)}
                    className={cn(
                      "flex w-full items-center justify-between px-2 py-1.5 cursor-pointer",
                      isCurrentModel && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={isCurrentModel}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {provider?.icon && <provider.icon className="size-3 flex-shrink-0" />}
                      <span className="text-xs truncate">{model.name}</span>
                    </div>
                    {isPro && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">Pro</span>
                    )}
                  </DropdownMenuItem>
                )
              })
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No models found
              </div>
            )}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 