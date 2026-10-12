import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { featureFlags } from "@/lib/features";
import { getPublicCategories } from "@/lib/queries/catalog";
import { getSetting } from "@/lib/settings";
import content from "@/content/preview/c/home.json";
import { flagOn } from "./header";
import { PhoolStrip } from "./motifs";

type Social = { label: string; href: string; icon: React.ReactNode };

const handle = (v: string) => v.trim().replace(/^@/, "");
const url = (v: string, base: string) => (/^https?:\/\//.test(v.trim()) ? v.trim() : `${base}${handle(v)}`);

/** Social links come only from Admin → Settings → Site; with none set, the block is omitted. */
function socials(site: { instagram: string | null; pinterest: string | null; whatsapp: string | null }): Social[] {
  const out: Social[] = [];
  if (site.instagram)
    out.push({
      label: "Instagram",
      href: url(site.instagram, "https://instagram.com/"),
      icon: (
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    });
  if (site.pinterest)
    out.push({
      label: "Pinterest",
      href: url(site.pinterest, "https://pinterest.com/"),
      icon: (
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.3-5.4s-.3-.7-.3-1.6c0-1.5.9-2.7 2-2.7.9 0 1.4.7 1.4 1.6 0 1-.6 2.4-.9 3.7-.3 1.1.6 2 1.7 2 2 0 3.5-2.1 3.5-5.2 0-2.7-2-4.6-4.8-4.6-3.3 0-5.2 2.5-5.2 5 0 1 .4 2.1.9 2.7.1.1.1.2.1.3l-.3 1.3c0 .2-.2.3-.4.2-1.4-.7-2.3-2.7-2.3-4.4 0-3.6 2.6-6.9 7.5-6.9 3.9 0 7 2.8 7 6.6 0 3.9-2.5 7.1-5.9 7.1-1.2 0-2.3-.6-2.6-1.3l-.7 2.7c-.3 1-1 2.2-1.4 3A10 10 0 1 0 12 2z" />
        </svg>
      ),
    });
  if (site.whatsapp)
    out.push({
      label: "WhatsApp",
      href: `https://wa.me/${site.whatsapp.replace(/\D/g, "")}`,
      icon: (
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" strokeLinejoin="round" />
          <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9c-1.2-.5-2.3-1.6-2.8-2.8l.9-1-1-2z" fill="currentColor" stroke="none" />
        </svg>
      ),
    });
  return out;
}

/**
 * Theme footer, rebuilt: wordmark + three link columns (75%) and social links
 * (25%). The old "download the app" block is left out. Light, with a phool-patti edge.
 */
export async function PcFooter() {
  const [categories, flags, site] = await Promise.all([getPublicCategories(), featureFlags(), getSetting("site")]);
  const social = socials(site);
  const f = content.footer;
  const link = "inline-flex min-h-10 items-center text-sm text-[var(--pc-muted)] hover:text-[var(--pc-ink)] hover:underline underline-offset-4 md:min-h-8";
  return (
    <footer className="mt-[60px] bg-white md:mt-20 lg:mt-[100px]">
      <PhoolStrip />
      <div className={`mx-auto grid max-w-[1400px] gap-x-5 gap-y-10 px-4 pt-12 pb-10 sm:px-6 ${social.length ? "md:grid-cols-[7fr_5fr] lg:grid-cols-[3fr_1fr]" : ""} lg:px-10`}>
        <div>
          <Logo tone="dark" className="[&_svg]:size-9 sm:[&_svg]:size-10 [&>span>span:first-child]:text-[2rem] sm:[&>span>span:first-child]:text-[2.5rem]" />
          <p className="mt-3 text-sm text-[var(--pc-muted)]">{f.tagline}</p>
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:max-w-4xl">
            {f.columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className={col.categories ? "max-sm:col-span-2 max-sm:order-last" : undefined}>
                <p className="text-xs font-semibold tracking-[0.08em] text-[var(--pc-ink)] uppercase">{col.title}</p>
                <ul className={col.categories ? "mt-2 grid grid-cols-2 gap-x-5 sm:grid-cols-1" : "mt-2"}>
                  {col.categories
                    ? categories.map((c) => (
                        <li key={c.slug}>
                          <Link className={link} href={`/category/${c.slug}`}>
                            {c.name}
                          </Link>
                        </li>
                      ))
                    : col.links
                        ?.filter((l) => l.href !== "/compare" || flagOn(flags, "compare"))
                        .map((l) => (
                          <li key={l.href}>
                            <Link className={link} href={l.href}>
                              {l.label}
                            </Link>
                          </li>
                        ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        {social.length ? (
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--pc-ink)] uppercase">{f.social}</p>
            <ul className="mt-3 flex gap-2">
              {social.map((so) => (
                <li key={so.label}>
                  <a href={so.href} target="_blank" rel="noopener" aria-label={so.label} className="pressable grid size-11 place-items-center rounded-full bg-[var(--pc-bg)] text-[var(--pc-ink)] shadow-[0_0_0_1px_var(--pc-line)] hover:bg-[var(--pc-magenta-tint)] hover:text-[var(--pc-magenta-ink)]">
                    {so.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t border-[var(--pc-line)]">
        <p className="mx-auto max-w-[1400px] px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] text-xs text-[var(--pc-muted)] sm:px-6 md:pb-6 lg:px-10">
          © {new Date().getFullYear()} Wahbayaan. Handmade in Pakistan.
        </p>
      </div>
    </footer>
  );
}
