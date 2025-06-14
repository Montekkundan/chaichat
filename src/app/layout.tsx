import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ConvexClientProvider from "~/components/providers/convex-client-provider";
import { ThemeProvider } from "~/components/providers/theme-provider";
import { ActiveThemeProvider } from "~/components/active-theme";
import { Toaster } from "~/components/ui/sonner";
import { CacheProvider } from "~/lib/providers/cache-provider";
import { ChatsProvider } from "~/lib/providers/chats-provider";
import { ModelsProvider } from "~/lib/providers/models-provider";
import { cookies } from "next/headers";

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

	return (
		<ClerkProvider>
			<html
				lang="en"
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
				suppressHydrationWarning
			>
				<body className="bg-sidebar">
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<ActiveThemeProvider initialTheme={activeThemeValue}>
							<ConvexClientProvider>
								<CacheProvider>
									<ChatsProvider>
										<ModelsProvider>
												{/* <Toaster position="top-center" /> */}
												{children}
										</ModelsProvider>
									</ChatsProvider>
								</CacheProvider>
							</ConvexClientProvider>
						</ActiveThemeProvider>
					</ThemeProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
