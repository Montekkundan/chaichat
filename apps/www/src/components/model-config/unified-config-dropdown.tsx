"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	UnifiedConfigPanel,
	type UnifiedConfigValue,
} from "./unified-config-panel";

type UnifiedConfigDropdownProps = {
	selectedModelId: string;
	value: UnifiedConfigValue;
	onChange: (update: Partial<UnifiedConfigValue>) => void;
	gateway?: "llm-gateway" | "vercel-ai-gateway";
	disabled?: boolean;
	children?: React.ReactNode;
};

export function UnifiedConfigDropdown({
	selectedModelId,
	value,
	onChange,
	gateway,
	disabled = false,
	children,
}: UnifiedConfigDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger asChild>
				{children || (
					<Button
						aria-label="Model Configuration"
						variant={"ghost"}
						size={"icon"}
						disabled={disabled}
					>
						<span className="button_content__eYZtX button_flex___f_3o">
							<span className="pointer-events-none flex rounded-md p-2">⚙️</span>
						</span>
					</Button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="max-h-[600px] w-[480px] overflow-y-auto"
			>
				<div className="space-y-2 p-2">
					<div className="px-1 font-semibold text-sm">
						Model & Provider Configuration
					</div>
					<UnifiedConfigPanel
						modelId={selectedModelId}
						value={value}
						onChange={onChange}
						gateway={gateway}
					/>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
