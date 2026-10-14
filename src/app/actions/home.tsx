"use server";

import { BestsellerPanel } from "@/components/store/home/sections";
import { getBuyerContext } from "@/lib/buyer-context";
import { getWishlistIds } from "@/lib/commerce/cart";
import { featureFlags } from "@/lib/features";
import { bestsellerTab, bestsellerTabDefs } from "@/lib/queries/home";
import { getCompareIds } from "@/lib/queries/storefront";

/**
 * A homepage bestseller tab, rendered on the server when the visitor first
 * opens (or hovers) it. Only the first tab is in the initial HTML, which keeps
 * the homepage light. Same guards and BuyerPrice as the rest of the page.
 */
export async function loadBestsellerPanel(tabId: string) {
  const flags = await featureFlags();
  const def = (await bestsellerTabDefs(flags)).find((t) => t.id === tabId);
  if (!def) return null;
  const [ctx, tab, compared] = await Promise.all([getBuyerContext(), bestsellerTab(def), getCompareIds()]);
  if (!tab) return null;
  const saved = await getWishlistIds(ctx.ownerKey);
  return <BestsellerPanel tab={tab} saved={saved} compared={flags.compare ? compared : null} />;
}
