"use client";

import { PricingTable, useSession, useUser } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { useQuota } from "~/lib/providers/quota-provider";

export default function SubscriptionPage() {
	const { user } = useUser();
	const { session } = useSession();
	const quota = useQuota();

	const handleDeleteAccount = async () => {
		if (confirm("Are you sure you want to delete your account?")) {
			await user?.delete();
			// Optionally redirect or show a message
		}
	};

	return (
		<div className="mx-auto max-w-4xl px-4 py-8 space-y-10">
			<div>
				<h1 className="text-2xl font-semibold mb-2">Your Plan</h1>
				<p className="text-muted-foreground mb-4">
					Current plan: <strong>{quota.plan}</strong>
				</p>
				<div className="rounded-md border p-4">
					<p className="mb-1 text-sm">Standard credits: {quota.stdCredits}</p>
					<p className="mb-1 text-sm">Premium credits: {quota.premiumCredits}</p>
					{quota.refillAt && (
						<p className="text-xs text-muted-foreground">
							Refill {new Date(quota.refillAt).toLocaleString()}
						</p>
					)}
				</div>
			</div>

			<div>
				<h2 className="text-xl font-semibold mb-4">Manage Subscription</h2>
				<PricingTable />
			</div>

			<section>
				<h2 className="text-xl font-semibold mb-2">Security</h2>
				<Button variant="destructive" onClick={handleDeleteAccount}>
					Delete Account
				</Button>
				<h3 className="mt-6 text-lg font-medium">Active Device</h3>
				<ul className="list-disc pl-5">
					{session && (
						<li key={session.id}>
							{session.lastActiveAt
								? `Last active: ${new Date(session.lastActiveAt).toLocaleString()}`
								: "Active"} (Current)
						</li>
					)}
				</ul>
			</section>
		</div>
	);
}
