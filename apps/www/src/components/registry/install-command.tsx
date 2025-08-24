"use client";

import * as React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export function InstallCommand({ slug, className }: { slug: string; className?: string }) {
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const url = `${origin}/r/${slug}.json`;
	const cmd = `npx shadcn@latest add "${url}"`;
	const [copied, setCopied] = React.useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(cmd);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {}
	};

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Input readOnly value={cmd} className="font-mono text-xs" />
			<Button onClick={copy} size="sm" variant="outline" className="shrink-0">
				{copied ? "Copied" : "Copy"}
			</Button>
		</div>
	);
}


