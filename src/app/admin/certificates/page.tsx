import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { reissueCertificateAction, voidCertificateAction } from "@/app/actions/admin/certificates";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/client-bits";
import { TextInput } from "@/components/admin/controls";
import { Empty, FilterBar, FilterSelect, StatusBadge, TableCard } from "@/components/admin/ui";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { certificates, orderItems, orders } from "@/lib/db/schema";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage(props: PageProps<"/admin/certificates">) {
  const user = await requireStaff("products.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const conds: SQL[] = [];
  const q = str(params, "q");
  if (q) conds.push(or(ilike(certificates.code, likeTerm(q)), ilike(certificates.title, likeTerm(q)), ilike(certificates.artisanName, likeTerm(q)))!);
  if (str(params, "status")) conds.push(eq(certificates.status, str(params, "status")));
  const where = and(...conds);
  const [rows, [{ n }]] = await Promise.all([
    d
      .select({ c: certificates, number: orders.number })
      .from(certificates)
      .leftJoin(orderItems, eq(orderItems.id, certificates.orderItemId))
      .leftJoin(orders, eq(orders.id, orderItems.orderId))
      .where(where)
      .orderBy(desc(certificates.issuedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(certificates).where(where),
  ]);
  const canManage = user.permissions.has("products.moderate");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Marketplace" title="Certificates of authenticity" description="Issued automatically for one-of-a-kind pieces when funds are released. Each has a public verification page." />
      <FilterBar action="/admin/certificates" q={q} placeholder="Code, piece or artisan">
        <FilterSelect name="status" label="Status" value={str(params, "status")} options={[{ value: "issued", label: "Issued" }, { value: "void", label: "Void" }]} />
      </FilterBar>
      <TableCard footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/certificates", params, { page: p })} />}>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Code</Th>
                <Th>Piece</Th>
                <Th>Artisan</Th>
                <Th>Order</Th>
                <Th>Issued</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {rows.map(({ c, number }) => (
                <Tr key={c.id}>
                  <Td className="whitespace-nowrap">
                    <code className="font-semibold text-gold-800">{c.code}</code>
                    <div className="mt-1 flex gap-1.5">
                      <a href={`/certificate/${c.code}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-800 hover:underline">
                        Public page <ExternalLink className="size-3" />
                      </a>
                      <CopyButton value={`/certificate/${c.code}`} label="Link" />
                    </div>
                  </Td>
                  <Td className="text-sm">
                    {c.productId ? (
                      <Link href={`/admin/listings/${c.productId}`} className="hover:text-terracotta-600">
                        {c.title}
                      </Link>
                    ) : (
                      c.title
                    )}
                    <p className="text-xs text-umber-500">
                      {c.materials.join(", ")} · {c.region}
                    </p>
                  </Td>
                  <Td className="text-sm">
                    <Link href={`/admin/artisans/${c.vendorId}`} className="hover:text-terracotta-600">
                      {c.artisanName}
                    </Link>
                    <p className="text-xs text-umber-500">{c.craft}</p>
                  </Td>
                  <Td>{number ? <Link href={`/admin/orders/${number}`} className="text-indigo-800 hover:underline">{number}</Link> : "—"}</Td>
                  <Td className="text-sm whitespace-nowrap">{formatDate(c.issuedAt)}</Td>
                  <Td>
                    <StatusBadge kind="certificate" status={c.status} />
                  </Td>
                  <Td>
                    {canManage ? (
                      <div className="flex flex-col items-end gap-1.5">
                        {c.status === "issued" ? (
                          <ActionForm action={voidCertificateAction} className="flex gap-1.5">
                            <input type="hidden" name="id" value={c.id} />
                            <TextInput name="reason" placeholder="Reason" required className="h-8 w-32 text-xs" aria-label="Reason for voiding" />
                            <SubmitButton variant="outline" className="h-8" confirm={`Void ${c.code}?`}>
                              Void
                            </SubmitButton>
                          </ActionForm>
                        ) : null}
                        <ActionButton action={reissueCertificateAction} fields={{ id: c.id }} confirm={`Issue a new code and void ${c.code}?`}>
                          Reissue
                        </ActionButton>
                      </div>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No certificates yet.</Empty>
        )}
      </TableCard>
    </div>
  );
}
