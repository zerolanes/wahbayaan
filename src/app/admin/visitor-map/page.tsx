import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { VisitorMapSlot } from "@/components/admin/visitor-map";
import { Card, CardHeader, Notice, PageHeader } from "@/components/ui/misc";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";

export const metadata = { title: "Visitor map" };

const FIXTURE_ON = process.env.NODE_ENV !== "production" || process.env.WB_VISITOR_MAP_FIXTURE === "1";

type FixturePlace = {
  key: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  visits: number;
  online: boolean;
};

/**
 * Demo of the admin visitor map. In development it runs on the fixture in
 * tests/fixtures/visitor-map.json (via /admin/api/visitor-map/fixture); in
 * production it reads the real /admin/api/analytics/map.
 *
 *   ?view=card      map inside a card instead of behind the page
 *   ?rotate=30      the fixture's latest visit changes every 30 s (new-visit flights)
 *   ?place=GB:London  set by clicking a cross; filters the table below
 *   ?table=0        hide the demo table (the e2e test uses this)
 */
export default async function VisitorMapDemoPage(props: PageProps<"/admin/visitor-map">) {
  await requireStaff("orders.view");
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const view = one(sp.view) === "card" ? "card" : "background";
  const rotate = Number(one(sp.rotate) ?? 0) || 0;
  const place = one(sp.place) ?? "";
  const dataUrl = FIXTURE_ON ? `/admin/api/visitor-map/fixture${rotate ? `?rotate=${rotate}` : ""}` : "/admin/api/analytics/map";

  let rows: FixturePlace[] = [];
  if (FIXTURE_ON) {
    const fixture = JSON.parse(await readFile(path.join(process.cwd(), "tests/fixtures/visitor-map.json"), "utf8")) as { places: FixturePlace[] };
    const [cc, city] = place.split(":");
    rows = fixture.places.filter((p) => !place || (p.countryCode === cc && (!city || p.city === city))).sort((a, b) => b.visits - a.visits);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Visitor map"
        description={FIXTURE_ON ? "Demo on fixture data. Click a cross to pin it and filter the table." : "Where visitors are browsing from."}
        actions={
          <Link className="text-sm underline" href={view === "card" ? "/admin/visitor-map" : "/admin/visitor-map?view=card"}>
            {view === "card" ? "Show behind the page" : "Show in a card"}
          </Link>
        }
      />
      {view === "card" ? <VisitorMapSlot mode="card" dataUrl={dataUrl} /> : <VisitorMapSlot mode="background" dataUrl={dataUrl} compact={false} />}
      {FIXTURE_ON && one(sp.table) !== "0" ? (
        <Card className="max-w-xl overflow-hidden">
          <CardHeader
            title="Places"
            description={place ? `Filtered to ${place.replace(":", " · ")}` : "Top places in the fixture"}
            action={
              place ? (
                <Link className="text-sm underline" href={view === "card" ? "?view=card" : "?"}>
                  Clear
                </Link>
              ) : null
            }
          />
          <div className="max-h-[38vh] overflow-y-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Place</Th>
                  <Th>Country</Th>
                  <Th className="text-right">Visits</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.slice(0, 12).map((r) => (
                  <Tr key={r.key}>
                    <Td>
                      {r.city ?? r.region ?? "—"} {r.online ? <span className="text-success-700 text-xs">· online</span> : null}
                    </Td>
                    <Td>{r.country}</Td>
                    <Td className="text-right tabular-nums">{r.visits}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : FIXTURE_ON ? null : (
        <Notice tone="pending">Visitor tracking data appears here once consented visits are recorded.</Notice>
      )}
    </div>
  );
}
