import { CaretDown } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Markdown } from "~/components/prompt-kit/markdown";
import { cn } from "~/lib/utils";

type ReasoningProps = {
	reasoning: string;
};

const TRANSITION = {
	type: "spring",
	duration: 0.2,
	bounce: 0,
};

export function Reasoning({ reasoning }: ReasoningProps) {
	const [isExpanded, setIsExpanded] = useState(true);

	return (
		<div>
			<button
				className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
				onClick={() => setIsExpanded(!isExpanded)}
				type="button"
			>
				<span>Reasoning</span>
				<CaretDown
					className={cn(
						"size-3 transition-transform",
						isExpanded ? "rotate-180" : "",
					)}
				/>
			</button>

			<AnimatePresence>
				{isExpanded && (
					<motion.div
						className="mt-2 overflow-hidden"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={TRANSITION}
					>
						<div className="flex flex-col border-muted-foreground/20 border-l pl-4 text-muted-foreground text-sm">
							<Markdown>{reasoning}</Markdown>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
