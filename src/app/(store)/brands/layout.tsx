import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Container } from "@/components/ui/misc";
import { getBuyerContext } from "@/lib/buyer-context";
import { getBrandBagCount } from "@/lib/brands/bag";
import { featureFlags } from "@/lib/features";

/** Pakistani Brands sub-navigation: directory, women, men, shop by link and the brand bag. */
export default async function BrandsLayout({ children }: LayoutProps<"/brands">) {
  const [ctx, flags] = await Promise.all([getBuyerContext(), featureFlags()]);
  const count = await getBrandBagCount(ctx.ownerKey);
  const link = "whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-umber-700 transition hover:bg-umber-900/5 hover:text-umber-900";
  return (
    <>
      <nav aria-label="Pakistani Brands" className="border-b border-umber-200/60">
        <Container className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          <Link href="/brands" className={`${link} font-semibold text-umber-900`}>
            Pakistani Brands
          </Link>
          <Link href="/brands/shop?for=women" className={link}>
            Women
          </Link>
          <Link href="/brands/shop?for=men" className={link}>
            Men
          </Link>
          <Link href="/brands/shop?new=1" className={link}>
            New in
          </Link>
          <Link href="/brands/shop?sale=1" className={link}>
            Sale
          </Link>
          {flags.brandRequests ? (
            <Link href="/brands/request" className={link}>
              Shop by link
            </Link>
          ) : null}
          <Link href="/brands/bag" className={`${link} ml-auto inline-flex items-center gap-1.5`} aria-label={`Brand bag (${count})`}>
            <ShoppingBag className="size-4" aria-hidden /> Bag{count ? ` (${count})` : ""}
          </Link>
        </Container>
      </nav>
      {children}
    </>
  );
}
