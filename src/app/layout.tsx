import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { ActiveThemeProvider } from "~/components/active-theme";
import ConvexClientProvider from "~/components/providers/convex-client-provider";
import { ThemeProvider } from "~/components/providers/theme-provider";
import { DEFAULT_APP_THEME } from "~/lib/config";
import { CacheProvider } from "~/lib/providers/cache-provider";
import { ChatsProvider } from "~/lib/providers/chats-provider";
import { ModelsProvider } from "~/lib/providers/models-provider";
import { QuotaProvider } from "~/lib/providers/quota-provider";
import { PostHogProvider } from "~/components/providers/posthog-provider";
import { ErrorBoundary } from "~/components/providers/error-boundary";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "ChaiChat",
	description: "AI-powered chat application",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const cookieStore = await cookies();
	const activeThemeValue = cookieStore.get("active_theme")?.value;

	type BasicChat = {
		_id: string;
		name: string;
		userId: string;
		currentModel: string;
		initialModel: string;
		createdAt: number;
		_creationTime: number;
		isPublic: boolean;
	};

	let initialChats: BasicChat[] = [];
	const chatsCookie = cookieStore.get("cc_chats")?.value;
	if (chatsCookie) {
		try {
			const parsed = JSON.parse(decodeURIComponent(chatsCookie));
			if (Array.isArray(parsed)) {
				initialChats = parsed.map((c): BasicChat => {
					const obj = c as { _id: string; name: string; currentModel?: string };
					return {
						_id: obj._id,
						name: obj.name,
						userId: "",
						currentModel: obj.currentModel ?? "",
						initialModel: obj.currentModel ?? "",
						createdAt: 0,
						_creationTime: 0,
						isPublic: false,
					};
				});
			}
		} catch {
			// ignore parse errors
		}
	}

	return (
		<ClerkProvider>
			<html
				lang="en"
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
				suppressHydrationWarning
			>
				<body
					className={`bg-sidebar theme-${activeThemeValue ?? DEFAULT_APP_THEME}`}
				>
					<PostHogProvider>
						<ErrorBoundary>
							<ThemeProvider
								attribute="class"
								defaultTheme="system"
								enableSystem
								disableTransitionOnChange
							>
								<ActiveThemeProvider initialTheme={activeThemeValue}>
									<ConvexClientProvider>
										<CacheProvider initialChats={initialChats}>
											<ChatsProvider>
												<ModelsProvider>
													<QuotaProvider>
														{/* <Toaster position="top-center" /> */}
														{children}
													</QuotaProvider>
												</ModelsProvider>
											</ChatsProvider>
										</CacheProvider>
									</ConvexClientProvider>
								</ActiveThemeProvider>
							</ThemeProvider>
						</ErrorBoundary>
					</PostHogProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}