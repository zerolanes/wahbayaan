/** Shared SEO values: one name, one description, one base URL for metadata, JSON-LD and the sitemap. */
export const SITE_NAME = "Wahbayaan";

export const SITE_DESCRIPTION =
  "Heritage craft from verified Pakistani artisans and pieces from Pakistani brands — delivered in Pakistan and abroad, every cost shown before you pay.";

export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Serialise JSON-LD for a <script> tag: `<` is escaped so text can never close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Homepage structured data: the Organization (with its social profiles) and the WebSite with its search. */
export function siteJsonLd(sameAs: string[] = []): string {
  const url = siteUrl();
  return jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: SITE_NAME,
        url: `${url}/`,
        logo: `${url}/icon.svg`,
        description: SITE_DESCRIPTION,
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name: SITE_NAME,
        url: `${url}/`,
        publisher: { "@id": `${url}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${url}/search?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  });
}
