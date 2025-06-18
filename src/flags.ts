import { flag } from "flags/next";

// Feature flag for the Clerk <PricingTable /> component.
// Default: enabled for everyone while in testing.
// You can override it via the Flags Explorer (Vercel Toolbar)
// or through your feature-flag provider.
export const pricingTableEnabled = flag({
  key: "pricing-table-enabled",
  decide() {
    // Enabled for all users by default during testing.
    return true;
  },
}); 