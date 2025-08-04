"use client";

import { useState, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { getProviderDebugInfo, isProviderEnabled } from "~/lib/debug-providers";

export function ProviderDebugPanel() {
	const [debugInfo, setDebugInfo] = useState<any>(null);

	useEffect(() => {
		const info = getProviderDebugInfo();
		setDebugInfo(info);
	}, []);

	if (!debugInfo) {
		return null;
	}

	const statusColor = debugInfo.allProvidersEnabled ? "destructive" : "default";
	const statusText = debugInfo.allProvidersEnabled ? "ALL PROVIDERS" : "TESTED ONLY";

	return (
		<Card className="border-dashed">
			<CardHeader className="pb-2">
				<CardTitle className="text-sm">Provider Configuration</CardTitle>
				<CardDescription className="text-xs">
					Current mode: <Badge variant={statusColor} className="ml-1">{statusText}</Badge>
				</CardDescription>
			</CardHeader>
			
			<CardContent className="pt-0">
				<div className="space-y-3">
					<div>
						<p className="text-xs font-medium mb-1">Environment Variable:</p>
						<code className="text-xs bg-muted px-2 py-1 rounded">
							ENABLE_ALL_PROVIDERS={debugInfo.envVariable || "undefined"}
						</code>
					</div>

					<div>
						<p className="text-xs font-medium mb-1">Tested Providers ({debugInfo.testedProviders.length}):</p>
						<div className="flex flex-wrap gap-1">
							{debugInfo.testedProviders.map((provider: string) => (
								<Badge key={provider} variant="secondary" className="text-xs">
									{provider}
								</Badge>
							))}
						</div>
					</div>

					{debugInfo.allProvidersEnabled && (
						<div className="p-2 bg-orange-50 dark:bg-orange-950 rounded border border-orange-200 dark:border-orange-800">
							<p className="text-xs text-orange-800 dark:text-orange-200">
								⚠️ All providers mode is enabled. Set <code>ENABLE_ALL_PROVIDERS=false</code> or remove the env var to use tested providers only.
							</p>
						</div>
					)}

					<div className="p-2 bg-muted rounded">
						<p className="text-xs">
							To add a new provider to the tested list, edit <code>TESTED_PROVIDERS</code> in <code>src/lib/config.ts</code>
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function ProviderStatusIndicator({ providerName }: { providerName: string }) {
	const isEnabled = isProviderEnabled(providerName);
	const debugInfo = getProviderDebugInfo();
	
	if (debugInfo.allProvidersEnabled) {
		return <Badge variant="secondary" className="text-xs">DEV</Badge>;
	}
	
	return isEnabled 
		? <Badge variant="default" className="text-xs">✓</Badge>
		: <Badge variant="outline" className="text-xs opacity-50">Hidden</Badge>;
}
