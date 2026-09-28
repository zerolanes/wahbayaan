import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Box, Film } from "lucide-react";
import { deleteMediaAction, saveMediaAltAction, uploadMediaAction } from "@/app/actions/admin/media";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck } from "@/components/admin/bulk";
import { ImageInput } from "@/components/admin/client-bits";
import { FieldRow, TextInput } from "@/components/admin/controls";
import { Empty, FilterBar, FilterSelect, MiniStat, Panel, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { media, users } from "@/lib/db/schema";
import { mediaUsage } from "@/lib/admin/media-usage";
import { hrefWith, pageCount, pageOf, str } from "@/lib/admin/params";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Media library" };

const SIZE = 24;

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const typeOf = (mime: string) => (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "model");

export default async function MediaPage(props: PageProps<"/admin/media">) {
  await requireStaff("media.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const all = await d
    .select({ m: media, uploader: users.name })
    .from(media)
    .leftJoin(users, eq(users.id, media.uploadedById))
    .orderBy(desc(media.createdAt))
    .limit(5000);
  const usage = await mediaUsage(all.map((x) => x.m.url));
  const f = { q: str(params, "q").toLowerCase(), type: str(params, "type"), use: str(params, "use"), alt: str(params, "alt"), id: str(params, "id") };
  const filtered = all.filter(({ m }) => {
    const used = (usage.get(m.url)?.length ?? 0) > 0;
    return (
      (!f.id || m.id === f.id) &&
      (!f.q || `${m.filename} ${m.alt ?? ""} ${m.url}`.toLowerCase().includes(f.q)) &&
      (!f.type || typeOf(m.mime) === f.type) &&
      (!f.use || (f.use === "used" ? used : !used)) &&
      (!f.alt || (f.alt === "missing" ? !m.alt && typeOf(m.mime) === "image" : !!m.alt))
    );
  });
  const rows = filtered.slice((page - 1) * SIZE, page * SIZE);
  const totalBytes = all.reduce((a, x) => a + x.m.sizeBytes, 0);
  const unused = all.filter((x) => !usage.get(x.m.url)?.length).length;
  const noAlt = all.filter((x) => !x.m.alt && typeOf(x.m.mime) === "image").length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Content" title="Media library" description="Every file uploaded through the admin and seller dashboards. Files that are in use can't be deleted." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Files" value={String(all.length)} hint={bytes(totalBytes)} />
        <MiniStat label="Not used anywhere" value={String(unused)} hint="Safe to delete" href={hrefWith("/admin/media", {}, { use: "unused" })} />
        <MiniStat label="Images without alt text" value={String(noAlt)} tone={noAlt ? "pending" : undefined} hint="Needed for accessibility and search" href={hrefWith("/admin/media", {}, { alt: "missing" })} />
        <MiniStat label="Videos & 3D models" value={String(all.filter((x) => typeOf(x.m.mime) !== "image").length)} />
      </div>

      <FilterBar action="/admin/media" q={str(params, "q")} placeholder="File name, alt text or URL">
        <FilterSelect name="type" label="Type" value={f.type} options={[{ value: "image", label: "Images" }, { value: "video", label: "Videos" }, { value: "model", label: "3D models" }]} />
        <FilterSelect name="use" label="Usage" value={f.use} options={[{ value: "used", label: "In use" }, { value: "unused", label: "Not used" }]} />
        <FilterSelect name="alt" label="Alt text" value={f.alt} options={[{ value: "missing", label: "Missing" }, { value: "set", label: "Set" }]} />
      </FilterBar>

      {f.id ? (
        <p className="text-sm text-umber-600">
          Showing one file ·{" "}
          <Link href="/admin/media" className="underline">
            show all
          </Link>
        </p>
      ) : null}

      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {filtered.length} file{filtered.length === 1 ? "" : "s"}
            </p>
            <BulkBar formId="media-bulk" action={deleteMediaAction} options={[{ value: "delete", label: "Delete (unused only)", confirm: "Delete the selected files? Files in use are skipped." }]} />
          </>
        }
        footer={pageCount(filtered.length, SIZE) > 1 ? <Pagination page={page} pageCount={pageCount(filtered.length, SIZE)} hrefFor={(p) => hrefWith("/admin/media", params, { page: p })} /> : undefined}
      >
        {rows.length ? (
          <ul className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {rows.map(({ m, uploader }) => {
              const uses = usage.get(m.url) ?? [];
              const kind = typeOf(m.mime);
              return (
                <li key={m.id} className={cn("flex flex-col overflow-hidden rounded-lg border bg-white", f.id === m.id ? "border-umber-900" : "border-umber-200")}>
                  <div className="relative aspect-[4/3] bg-umber-100">
                    {kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-umber-400">{kind === "video" ? <Film className="size-8" /> : <Box className="size-8" />}</div>
                    )}
                    <label className="absolute top-2 left-2 rounded bg-white/90 p-1 shadow-sm">
                      <RowCheck formId="media-bulk" value={m.id} label={`Select ${m.filename}`} />
                    </label>
                    <div className="absolute top-2 right-2">{uses.length ? <Badge tone="success">In use · {uses.length}</Badge> : <Badge tone="neutral">Unused</Badge>}</div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3 text-xs">
                    <div>
                      <a href={m.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-umber-900 hover:underline" title={m.filename}>
                        {m.filename}
                      </a>
                      <p className="text-umber-500">
                        {m.mime.split("/")[1]?.toUpperCase()} · {bytes(m.sizeBytes)} · {formatDate(m.createdAt)}
                        {uploader ? ` · ${uploader}` : ""}
                      </p>
                    </div>
                    {uses.length ? (
                      <ul className="space-y-0.5 text-umber-600">
                        {uses.slice(0, 3).map((u, i) => (
                          <li key={i} className="truncate">
                            {u.kind}:{" "}
                            {u.href ? (
                              <Link href={u.href} className="text-umber-900 hover:underline">
                                {u.label || "—"}
                              </Link>
                            ) : (
                              u.label || "—"
                            )}
                          </li>
                        ))}
                        {uses.length > 3 ? <li className="text-umber-400">+{uses.length - 3} more</li> : null}
                      </ul>
                    ) : (
                      <p className="text-umber-400">Not referenced by any listing, artisan, category, collection, journal post or page.</p>
                    )}
                    <ActionForm action={saveMediaAltAction} className="mt-auto flex gap-1.5">
                      <input type="hidden" name="id" value={m.id} />
                      <TextInput name="alt" defaultValue={m.alt ?? ""} placeholder={kind === "image" ? "Alt text — describe the piece" : "Description"} aria-label={`Alt text for ${m.filename}`} className={cn("h-8 text-xs", !m.alt && kind === "image" && "border-pending-600/40")} />
                      <SubmitButton variant="outline">Save</SubmitButton>
                    </ActionForm>
                    {!uses.length ? (
                      <ActionButton action={deleteMediaAction} fields={{ "ids[]": m.id }} variant="ghost" confirm={`Delete ${m.filename}? The file is removed from storage.`} className="self-start">
                        Delete
                      </ActionButton>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{all.length ? "No files match these filters." : "Nothing uploaded yet. Images uploaded for listings, artisans and categories appear here — or upload below."}</Empty>
        )}
      </TableCard>

      <Panel title="Upload" description="JPG, PNG, WebP, AVIF, MP4 or GLB, up to 10 MB each. Real photography only for listings — illustrations must be labelled where they're used.">
        <ActionForm action={uploadMediaAction} resetOnSuccess className="space-y-3">
          <ImageInput name="files" multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,model/gltf-binary,.glb" label="Choose files" />
          <FieldRow label="Alt text (applied to every file in this upload)">
            <TextInput name="alt" placeholder="Optional" className="max-w-md" />
          </FieldRow>
          <SubmitButton>Upload</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
