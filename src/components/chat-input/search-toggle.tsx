"use client";

import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

interface SearchToggleProps {
  searchEnabled: boolean;
  onSearchEnabledChange: (enabled: boolean) => void;
  modelSupportsSearch: boolean;
  className?: string;
}

export function SearchToggle({
  searchEnabled,
  onSearchEnabledChange,
  modelSupportsSearch,
  className,
}: SearchToggleProps) {
  if (!modelSupportsSearch) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="search-toggle" className="text-sm font-medium">
              Web Search
            </Label>
            <Switch
              id="search-toggle"
              checked={searchEnabled}
              onCheckedChange={onSearchEnabledChange}
              disabled={!modelSupportsSearch}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Enable web search to get current information and recent updates.
            {!modelSupportsSearch && " This model doesn't support web search."}
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
