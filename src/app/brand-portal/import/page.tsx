import { desc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { ImportFlow } from "@/components/brand-portal/import-flow";
import { Panel } from "@/components/admin/ui";
import { PageHeader } from "@/components/ui/misc";
import { requireBrandMember } from "@/lib/brand-portal/access";
import { BRAND_CSV_COLUMNS, BRAND_CSV_MAX_ROWS } from "@/lib/brand-portal/csv";
import { db } from "@/lib/db/client";
import { brandSyncRuns } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "CSV upload" };

const COLUMN_HELP: Record<string, string> = {
  handle: "Links rows of the same product (optional — the title is used otherwise)",
  title: "Product name (required on the first row of each product)",
  audience: "women, men, kids or unisex",
  image_urls: "https:// photo links, separated by |",
  sku: "Required. Identifies the variant — re-uploads update it",
  price_pkr: "Required. Rupees, e.g. 5490",
  compare_at_price_pkr: "Original price when on sale",
  stock: "Whole number; blank = not tracked; 0 = sold out",
  weight_g: "Parcel weight in grams",
  status: "draft (default), published or hidden",
};

export default async function PortalImport() {
  const user = await requireBrandMember();
  const d = await db();
  const runs = await d.select().from(brandSyncRuns).where(eq(brandSyncRuns.brandId, user.brandId)).orderBy(desc(brandSyncRuns.startedAt)).limit(5);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Catalogue" title="CSV upload" description="Add or update many products at once. One row per variant (size / colour). Check the file first — nothing changes until you press Import." />
      <Panel
        title="1. Start from the template"
        action={
          <a href="/brand-portal/import/template" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-800 hover:underline" download>
            <Download className="size-4" aria-hidden /> Download template
          </a>
        }
      >
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {BRAND_CSV_COLUMNS.map((c) => (
            <div key={c} className="flex gap-2">
              <dt className="w-44 shrink-0 font-mono text-xs leading-5 text-umber-800">{c}</dt>
              <dd className="text-umber-600">{COLUMN_HELP[c] ?? ""}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-umber-500">Up to {BRAND_CSV_MAX_ROWS} rows and 2 MB per file. Variants missing from the file are left as they are.</p>
      </Panel>
      <Panel title="2. Upload and check">
        <ImportFlow />
      </Panel>
      {runs.length ? (
        <Panel title="Recent uploads">
          <ul className="space-y-1 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-3 text-umber-700">
                <span className="text-umber-500">{formatDateTime(r.startedAt)}</span>
                <span>
                  {r.status === "refused" ? "Refused" : `${r.added} new, ${r.updated} updated, ${r.unchanged} unchanged${r.failed ? `, ${r.failed} skipped` : ""}`}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
