import { pricingTableEnabled } from "~/flags";

// Dynamic import avoids RSC export resolution issues during build.

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type SubscriptionClientType from "./subscription-client";

export default async function SubscriptionPage() {
	const showPricing = await pricingTableEnabled();
	const { default: SubscriptionClient } = (await import("./subscription-client")) as {
		default: typeof SubscriptionClientType;
	};
	return <SubscriptionClient showPricing={showPricing} />;
}
