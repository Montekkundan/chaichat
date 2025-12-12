"use client";

import { SlidersHorizontal } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
import {
	UnifiedConfigPanel,
	type UnifiedConfigValue,
} from "./unified-config-panel";

type UnifiedConfigSheetProps = {
	selectedModelId: string;
	value: UnifiedConfigValue;
	onChange: (update: Partial<UnifiedConfigValue>) => void;
	gateway?: "llm-gateway" | "vercel-ai-gateway";
	disabled?: boolean;
};

export function UnifiedConfigSheet({
	selectedModelId,
	value,
	onChange,
	gateway,
	disabled = false,
}: UnifiedConfigSheetProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Sheet open={isOpen} onOpenChange={setIsOpen}>
			<SheetTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					disabled={disabled}
					className="h-8 w-8 p-0"
					aria-label="Model and provider options"
				>
					<SlidersHorizontal className="h-4 w-4" />
				</Button>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="w-[500px] overflow-y-auto sm:w-[600px]"
			>
				<SheetHeader>
					<SheetTitle>Model & Provider Configuration</SheetTitle>
				</SheetHeader>
				<div className="mt-6">
					<UnifiedConfigPanel
						modelId={selectedModelId}
						value={value}
						onChange={onChange}
						gateway={gateway}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
