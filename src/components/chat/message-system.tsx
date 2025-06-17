import React from "react";
import { Message, MessageContent } from "~/components/prompt-kit/message";
import { cn } from "~/lib/utils";

export function MessageSystem({ children }: { children: string }) {
	return (
		<Message className="flex w-full max-w-3xl items-start gap-4 px-6 pb-2">
			<div className="flex min-w-full flex-col gap-2">
				<MessageContent
					className={cn(
						"prose dark:prose-invert w-full rounded-md border border-border bg-muted/50 p-4 text-foreground text-sm",
					)}
				>
					{children}
				</MessageContent>
			</div>
		</Message>
	);
}
