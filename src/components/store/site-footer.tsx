import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import content from "@/content/home.json";
import { featureFlags } from "@/lib/features";
import { activeSocialLinks } from "@/lib/social";
import { getPublicCategories } from "@/lib/queries/catalog";
import { getSetting } from "@/lib/settings";
import { flagOn } from "./site-header";
import { SocialLinksList } from "./social-links";
import { PhoolStrip } from "./truck-art";

/**
 * Shared storefront footer (design direction C): light, with a phool-patti
 * edge — wordmark and link columns, then social icons (only the profiles set
 * in Admin → Settings → Social links; none set, no block). Copy lives in
 * `src/content/home.json`; links to switched-off features drop out.
 */
export async function SiteFooter() {
  const [categories, flags, social] = await Promise.all([getPublicCategories(), featureFlags(), getSetting("social_links")]);
  const hasSocial = activeSocialLinks(social).length > 0;
  const f = content.footer;
  const link = "inline-flex min-h-10 items-center text-sm text-[var(--wb-muted)] underline-offset-4 hover:text-[var(--wb-ink)] hover:underline md:min-h-8";
  return (
    <footer className="mt-[60px] bg-white md:mt-20 lg:mt-[100px]">
      <PhoolStrip />
      <div className={`mx-auto grid max-w-[1400px] gap-x-5 gap-y-10 px-4 pt-12 pb-10 sm:px-6 lg:px-10 ${hasSocial ? "lg:grid-cols-[4fr_1fr]" : ""}`}>
        <div>
          <Logo tone="dark" className="[&_svg]:size-9 sm:[&_svg]:size-10 [&>span>span:first-child]:text-[2rem] sm:[&>span>span:first-child]:text-[2.5rem]" />
          <p className="mt-3 text-sm text-[var(--wb-muted)]">{f.tagline}</p>
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
            {f.columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className={col.categories ? "max-md:order-last max-md:col-span-2" : undefined}>
                <p className="text-xs font-semibold tracking-[0.08em] text-[var(--wb-ink)] uppercase">{col.title}</p>
                <ul className={col.categories ? "mt-2 grid grid-cols-2 gap-x-5 md:grid-cols-1" : "mt-2"}>
                  {col.categories
                    ? categories.map((c) => (
                        <li key={c.slug}>
                          <Link className={link} href={`/category/${c.slug}`}>
                            {c.name}
                          </Link>
                        </li>
                      ))
                    : col.links
                        ?.filter((l) => flagOn(flags, "flag" in l ? l.flag : undefined))
                        .map((l) => (
                          <li key={l.href}>
                            {l.href.startsWith("#") ? (
                              <a className={link} href={l.href}>
                                {l.label}
                              </a>
                            ) : (
                              <Link className={link} href={l.href}>
                                {l.label}
                              </Link>
                            )}
                          </li>
                        ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        {hasSocial ? (
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--wb-ink)] uppercase">{f.social}</p>
            <SocialLinksList
              links={social}
              owner="Wahbayaan"
              className="mt-3 gap-2"
              linkClassName="size-11 bg-[var(--wb-bg)] text-[var(--wb-ink)] shadow-[0_0_0_1px_var(--wb-line)] hover:bg-[var(--wb-magenta-tint)] hover:text-[var(--wb-magenta-ink)]"
            />
          </div>
        ) : null}
      </div>
      <div className="border-t border-[var(--wb-line)]">
        <p className="mx-auto max-w-[1400px] px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] text-xs text-[var(--wb-muted)] sm:px-6 md:pb-6 lg:px-10">
          © {new Date().getFullYear()} Wahbayaan. Handmade in Pakistan.
        </p>
      </div>
    </footer>
  );
}
