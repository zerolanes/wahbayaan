"use server";

import { redirect } from "next/navigation";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { announcements, categories, faqs, journalPosts, pages, vendors } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/settings";
import { saveUpload } from "@/lib/storage";
import { slugify } from "@/lib/ids";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { RESERVED_PAGE_SLUGS, POLICY_SLUGS } from "@/lib/admin/content";
import { zBool, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

/** `datetime-local` values are entered as UTC (the forms say so). */
const zUtcDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? new Date(/Z$|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`) : null),
  z.date().refine((d) => !Number.isNaN(d.getTime()), "Invalid date").nullable(),
);

// ── Homepage ────────────────────────────────────────────────────────────────

export const saveHomeAction = adminAction(
  "content.manage",
  z.object({
    heroEyebrow: zStr(120),
    heroTitle: zStr(120),
    heroSubtitle: zStr(400),
    featuredVendorIds: z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().uuid()).max(12, "Pick up to 12 artisans")),
  }),
  async ({ data, audit }) => {
    const d = await db();
    const found = data.featuredVendorIds.length ? await d.select({ id: vendors.id }).from(vendors).where(inArray(vendors.id, data.featuredVendorIds)) : [];
    const ids = data.featuredVendorIds.filter((id) => found.some((f) => f.id === id));
    const before = await getSetting("home");
    await setSetting("home", { heroEyebrow: data.heroEyebrow, heroTitle: data.heroTitle, heroSubtitle: data.heroSubtitle, featuredVendorIds: ids });
    const changed = (["heroEyebrow", "heroTitle", "heroSubtitle"] as const).filter((k) => before[k] !== data[k]);
    if (JSON.stringify(before.featuredVendorIds) !== JSON.stringify(ids)) changed.push("featuredVendorIds" as never);
    await audit({ action: "setting.update", entity: "setting", entityId: "home", summary: `Updated the homepage (${changed.join(", ") || "no changes"})`, data: { before, after: { ...data, featuredVendorIds: ids } } });
    return { message: "Homepage updated" };
  },
);

// ── CMS pages ───────────────────────────────────────────────────────────────

const zSlug = zStr(80).transform((s) => slugify(s));

export const createPageAction = adminAction("content.manage", z.object({ title: zStr(160), slug: z.string().optional() }), async ({ data, audit }) => {
  const slug = slugify(data.slug || data.title);
  if (!slug) throw new AdminError("Choose a URL for the page.");
  if (RESERVED_PAGE_SLUGS.includes(slug)) throw new AdminError(`/${slug} is already a storefront page — pick another URL.`);
  const d = await db();
  if (await d.query.pages.findFirst({ where: eq(pages.slug, slug) })) throw new AdminError(`A page at /${slug} already exists.`);
  await d.insert(pages).values({ slug, title: data.title, body: "", status: "draft" });
  await audit({ action: "page.create", entity: "page", entityId: slug, summary: `Created page /${slug}` });
  redirect(`/admin/content/pages/${slug}`);
});

export const updatePageAction = adminAction(
  "content.manage",
  z.object({ slug: zStr(80), newSlug: zSlug, title: zStr(160), body: z.string().max(100_000), seoDescription: zOptStr(300), status: z.enum(["draft", "published"]) }),
  async ({ data, audit }) => {
    const d = await db();
    const p = await d.query.pages.findFirst({ where: eq(pages.slug, data.slug) });
    if (!p) throw new AdminError("Page not found");
    if (data.newSlug !== p.slug) {
      if (POLICY_SLUGS.includes(p.slug)) throw new AdminError("Policy pages keep their URL — the footer and checkout link to it.");
      if (RESERVED_PAGE_SLUGS.includes(data.newSlug)) throw new AdminError(`/${data.newSlug} is already a storefront page.`);
      if (await d.query.pages.findFirst({ where: eq(pages.slug, data.newSlug) })) throw new AdminError(`A page at /${data.newSlug} already exists.`);
    }
    if (!data.body.trim()) throw new AdminError("The page needs some content.");
    await d.update(pages).set({ slug: data.newSlug, title: data.title, body: data.body, seoDescription: data.seoDescription, status: data.status }).where(eq(pages.slug, p.slug));
    await audit({
      action: "page.update",
      entity: "page",
      entityId: data.newSlug,
      summary: `Edited /${data.newSlug}${p.status !== data.status ? ` · ${data.status}` : ""}${p.slug !== data.newSlug ? ` (moved from /${p.slug})` : ""}`,
      data: { previousBody: p.body !== data.body ? p.body : undefined },
    });
    if (data.newSlug !== p.slug) redirect(`/admin/content/pages/${data.newSlug}`);
    return { message: data.status === "published" ? "Published" : "Saved as draft" };
  },
);

export const deletePageAction = adminAction("content.manage", z.object({ slug: zStr(80) }), async ({ data, audit }) => {
  if (POLICY_SLUGS.includes(data.slug)) throw new AdminError("Policy pages can't be deleted — set them to draft instead.");
  const d = await db();
  const [p] = await d.delete(pages).where(eq(pages.slug, data.slug)).returning();
  if (!p) throw new AdminError("Page not found");
  await audit({ action: "page.delete", entity: "page", entityId: p.slug, summary: `Deleted page /${p.slug}`, data: { title: p.title, body: p.body } });
  redirect("/admin/content/pages");
});

// ── FAQ ─────────────────────────────────────────────────────────────────────

const faqFields = { question: zStr(300), answer: zStr(4000), group: zStr(60), isPublished: zBool };

export const createFaqAction = adminAction("content.manage", z.object(faqFields), async ({ data, audit }) => {
  const d = await db();
  const [{ max }] = await d.select({ max: sql<number>`coalesce(max(${faqs.sort}), -1)::int` }).from(faqs);
  const [f] = await d.insert(faqs).values({ ...data, sort: Number(max) + 1 }).returning();
  await audit({ action: "faq.create", entity: "faq", entityId: f.id, summary: `Added FAQ “${f.question}”` });
  return { message: "Question added" };
});

export const updateFaqAction = adminAction("content.manage", z.object({ id: zUuid, ...faqFields }), async ({ data, audit }) => {
  const d = await db();
  const { id, ...rest } = data;
  const [f] = await d.update(faqs).set(rest).where(eq(faqs.id, id)).returning();
  if (!f) throw new AdminError("Question not found");
  await audit({ action: "faq.update", entity: "faq", entityId: f.id, summary: `Edited FAQ “${f.question}”` });
  return { message: "Saved" };
});

export const deleteFaqAction = adminAction("content.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const [f] = await d.delete(faqs).where(eq(faqs.id, data.id)).returning();
  if (!f) throw new AdminError("Question not found");
  await audit({ action: "faq.delete", entity: "faq", entityId: f.id, summary: `Deleted FAQ “${f.question}”` });
  return { message: "Deleted" };
});

export const moveFaqAction = adminAction("content.manage", z.object({ id: zUuid, dir: z.enum(["up", "down"]) }), async ({ data }) => {
  const d = await db();
  const rows = await d.select().from(faqs).orderBy(asc(faqs.sort));
  const i = rows.findIndex((r) => r.id === data.id);
  const j = data.dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return { message: "Already at the edge" };
  [rows[i], rows[j]] = [rows[j], rows[i]];
  for (const [k, r] of rows.entries()) if (r.sort !== k) await d.update(faqs).set({ sort: k }).where(eq(faqs.id, r.id));
  return { message: "Order updated" };
});

// ── Journal ─────────────────────────────────────────────────────────────────

export const createJournalAction = adminAction("content.manage", z.object({ title: zStr(200) }), async ({ user, data, audit }) => {
  const d = await db();
  let slug = slugify(data.title);
  if (await d.query.journalPosts.findFirst({ where: eq(journalPosts.slug, slug) })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const [p] = await d.insert(journalPosts).values({ title: data.title, slug, body: "", authorName: user.name, status: "draft" }).returning();
  await audit({ action: "journal.create", entity: "journal", entityId: p.id, summary: `Started journal post “${p.title}”` });
  redirect(`/admin/content/journal/${p.id}`);
});

export const updateJournalAction = adminAction(
  "content.manage",
  z.object({
    id: zUuid,
    title: zStr(200),
    slug: zSlug,
    excerpt: zOptStr(400),
    body: z.string().max(200_000),
    categoryId: z.string().optional(),
    authorName: zOptStr(120),
    coverImageUrl: zOptStr(500),
    seoTitle: zOptStr(120),
    seoDescription: zOptStr(300),
    status: z.enum(["draft", "published"]),
    publishedAt: zUtcDate,
  }),
  async ({ user, data, formData, audit }) => {
    const d = await db();
    const p = await d.query.journalPosts.findFirst({ where: eq(journalPosts.id, data.id) });
    if (!p) throw new AdminError("Post not found");
    if (await d.query.journalPosts.findFirst({ where: and(eq(journalPosts.slug, data.slug), ne(journalPosts.id, p.id)) })) throw new AdminError(`The URL /journal/${data.slug} is taken.`);
    if (data.status === "published" && !data.body.trim()) throw new AdminError("Write the post before publishing it.");
    if (data.categoryId && !(await d.query.categories.findFirst({ where: eq(categories.id, data.categoryId) }))) throw new AdminError("Unknown category");
    const [cover] = files(formData, "cover");
    const coverUrl = cover ? await saveUpload(cover, { uploadedById: user.id, alt: `${data.title} — cover` }) : data.coverImageUrl;
    const publishedAt = data.status === "published" ? (data.publishedAt ?? p.publishedAt ?? new Date()) : data.publishedAt;
    await d
      .update(journalPosts)
      .set({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        body: data.body,
        categoryId: data.categoryId || null,
        authorName: data.authorName,
        coverImageUrl: coverUrl,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        status: data.status,
        publishedAt,
      })
      .where(eq(journalPosts.id, p.id));
    const scheduled = data.status === "published" && publishedAt && publishedAt > new Date();
    await audit({
      action: "journal.update",
      entity: "journal",
      entityId: p.id,
      summary: `Edited “${data.title}”${data.status !== p.status || scheduled ? ` · ${scheduled ? `scheduled for ${publishedAt!.toISOString().slice(0, 16).replace("T", " ")} UTC` : data.status}` : ""}`,
    });
    return { message: scheduled ? "Scheduled" : data.status === "published" ? "Published" : "Saved as draft" };
  },
);

export const deleteJournalAction = adminAction("content.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const [p] = await d.delete(journalPosts).where(eq(journalPosts.id, data.id)).returning();
  if (!p) throw new AdminError("Post not found");
  await audit({ action: "journal.delete", entity: "journal", entityId: p.id, summary: `Deleted journal post “${p.title}”`, data: { slug: p.slug } });
  redirect("/admin/content/journal");
});

// ── Announcements (site banner) ─────────────────────────────────────────────

const announcementFields = {
  message: zStr(200),
  link: zOptStr(300).refine((v) => !v || v.startsWith("/") || /^https:\/\//.test(v), "Use a site path like /shop or an https:// link"),
  isActive: zBool,
  startsAt: zUtcDate,
  endsAt: zUtcDate,
};

function checkWindow(a: { startsAt: Date | null; endsAt: Date | null }) {
  if (a.startsAt && a.endsAt && a.endsAt <= a.startsAt) throw new AdminError("The end must be after the start.");
}

export const createAnnouncementAction = adminAction("marketing.manage", z.object(announcementFields), async ({ data, audit }) => {
  checkWindow(data);
  const d = await db();
  const [a] = await d.insert(announcements).values(data).returning();
  await audit({ action: "announcement.create", entity: "announcement", entityId: a.id, summary: `Created announcement “${a.message}”${a.isActive ? " (on)" : ""}` });
  return { message: "Announcement created" };
});

export const updateAnnouncementAction = adminAction("marketing.manage", z.object({ id: zUuid, ...announcementFields }), async ({ data, audit }) => {
  checkWindow(data);
  const d = await db();
  const { id, ...rest } = data;
  const [a] = await d.update(announcements).set(rest).where(eq(announcements.id, id)).returning();
  if (!a) throw new AdminError("Announcement not found");
  await audit({ action: "announcement.update", entity: "announcement", entityId: a.id, summary: `Edited announcement “${a.message}”${a.isActive ? "" : " (off)"}` });
  return { message: "Saved" };
});

export const toggleAnnouncementAction = adminAction("marketing.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const a = await d.query.announcements.findFirst({ where: eq(announcements.id, data.id) });
  if (!a) throw new AdminError("Announcement not found");
  await d.update(announcements).set({ isActive: !a.isActive }).where(eq(announcements.id, a.id));
  await audit({ action: a.isActive ? "announcement.off" : "announcement.on", entity: "announcement", entityId: a.id, summary: `Turned ${a.isActive ? "off" : "on"} “${a.message}”` });
  return { message: a.isActive ? "Turned off" : "Turned on" };
});

export const deleteAnnouncementAction = adminAction("marketing.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const [a] = await d.delete(announcements).where(eq(announcements.id, data.id)).returning();
  if (!a) throw new AdminError("Announcement not found");
  await audit({ action: "announcement.delete", entity: "announcement", entityId: a.id, summary: `Deleted announcement “${a.message}”` });
  return { message: "Deleted" };
});
