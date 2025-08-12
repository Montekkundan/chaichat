"use client";

import * as React from "react";
import { LayoutMain } from "~/components/chat/layout-chat";
import { OpenInV0Button } from "~/components/open-in-v0-button";
// import { ModelSelector } from "~/registry/blocks/model-selector/model-selector";
import { SettingsAppearance } from "~/registry/blocks/settings-appearance/settings-appearance";

export default function Home() {
	const [selectedModel, setSelectedModel] = React.useState("llama-3.1-70b");
	return (
		<LayoutMain>
			<div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
				<header className="flex flex-col gap-1">
					<h1 className="font-bold text-3xl tracking-tight">Custom Registry</h1>
					<p className="text-muted-foreground">
						A custom registry for distributing code using shadcn.
					</p>
				</header>
				<main className="space-y-8">
					<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
						<div className="relative flex flex-col gap-4 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<h2 className="text-muted-foreground text-sm sm:pl-3">
									A dropdown component for selecting AI models with search and
									filtering capabilities
								</h2>
								<OpenInV0Button name="model-selector" className="w-fit" />
							</div>
							{/* <div className="relative flex min-h-[300px] items-center justify-center">
								<div className="space-y-4">
									<div className="text-center">
										<h3 className="mb-2 font-semibold text-lg">
											Default Configuration
										</h3>
										<ModelSelector
											selectedModelId={selectedModel}
											setSelectedModelId={setSelectedModel}
										/>
									</div>
								</div>
							</div> */}
						</div>

						<div className="relative flex flex-col gap-4 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<h2 className="text-muted-foreground text-sm sm:pl-3">
									A settings appearance panel with theme toggle and Tweakcn
									theme URL input
								</h2>
								<OpenInV0Button name="settings-appearance" className="w-fit" />
							</div>
							<div className="relative max-h-[600px] overflow-y-auto">
								<SettingsAppearance />
							</div>
						</div>
					</div>
				</main>
			</div>
		</LayoutMain>
	);
}
