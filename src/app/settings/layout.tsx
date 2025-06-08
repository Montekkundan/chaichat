"use client";

import { useUser } from "@clerk/nextjs";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { TextHoverEffect } from "~/components/ui/text-hover-effect";
import { ThemeSwitcher } from "~/components/ui/theme-switcher";
import { useIsMobile } from "~/hooks/use-mobile";

const tabMap: Record<string, string> = {
	"/settings/subscription": "subscription",
	"/settings/customization": "customization",
	"/settings/history": "history",
	"/settings/models": "models",
	"/settings/api-keys": "api-keys",
	"/settings/attachments": "attachments",
	"/settings/contact": "contact",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
	const { user } = useUser();
	const pathname = usePathname();
	const tabValue = tabMap[pathname] || "subscription";
	const isMobile = useIsMobile();

	return (
		<div className="flex min-h-screen flex-col">
			{/* Navbar */}
			<div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 lg:px-8">
				<nav className="flex items-center justify-between border-b py-4">
					<Link href="/" className="font-semibold text-lg hover:underline">
						← Back to Chats
					</Link>
					<div className="flex items-center gap-4">
						<ThemeSwitcher />
						<SignOutButton>
							<Button variant="outline">Sign out</Button>
						</SignOutButton>
					</div>
				</nav>
			</div>
			<div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 overflow-hidden px-4 pt-safe-offset-6 pb-24 md:flex-row md:px-6 lg:px-8">
				{!isMobile && (
					<aside className="w-[340px] flex-shrink-0 border-r p-6 text-center">
						<div className="mb-8">
							<img
								src={user?.imageUrl}
								alt={user?.fullName || "User"}
								className="mx-auto mb-4 h-24 w-24 rounded-full"
							/>
							<h2 className="mb-1 font-semibold text-lg">{user?.fullName}</h2>
							<p className="text-muted-foreground text-sm">
								{user?.primaryEmailAddress?.emailAddress}
							</p>
						</div>
					</aside>
				)}
				<main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-12">
					<Tabs value={tabValue} className="mb-6">
						<div className="flex">
							<TabsList className="flex gap-0.5 rounded-lg bg-muted p-1">
								<TabsTrigger asChild value="subscription">
									<Link
										href="/settings/subscription"
										className="px-2 py-1 text-sm"
									>
										Subscription
									</Link>
								</TabsTrigger>
								<TabsTrigger asChild value="customization">
									<Link
										href="/settings/customization"
										className="px-2 py-1 text-sm"
									>
										Customization
									</Link>
								</TabsTrigger>
								<TabsTrigger asChild value="history">
									<Link href="/settings/history" className="px-2 py-1 text-sm">
										History
									</Link>
								</TabsTrigger>
								<TabsTrigger asChild value="models">
									<Link href="/settings/models" className="px-2 py-1 text-sm">
										Models
									</Link>
								</TabsTrigger>
								<TabsTrigger asChild value="api-keys">
									<Link href="/settings/api-keys" className="px-2 py-1 text-sm">
										API Keys
									</Link>
								</TabsTrigger>
								<TabsTrigger asChild value="attachments">
									<Link
										href="/settings/attachments"
										className="px-2 py-1 text-sm"
									>
										Attachments
									</Link>
								</TabsTrigger>
								<TabsTrigger asChild value="contact">
									<Link href="/settings/contact" className="px-2 py-1 text-sm">
										Contact
									</Link>
								</TabsTrigger>
							</TabsList>
						</div>
					</Tabs>
					{children}
				</main>
			</div>
			{!isMobile && (
				<footer className="w-full border-t">
					<div className="flex items-center justify-center py-8">
						<TextHoverEffect text="ChaiChat" />
					</div>
				</footer>
			)}
		</div>
	);
}
