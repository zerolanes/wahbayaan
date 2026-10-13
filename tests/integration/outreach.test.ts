/**
 * Brand outreach against a throwaway embedded Postgres: importing the research
 * CSV twice (idempotent, staff edits kept, brand/directory links), the default
 * templates, the send path (logged to the outbox without a provider) and the
 * opt-out link (do not contact + suppression, tampered tokens ignored).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-outreach-"));
process.env.PGLITE_DIR = path.join(dir, "db");
process.env.DATABASE_URL = "";
delete process.env.RESEND_API_KEY;
process.env.APP_URL = "https://wahbayaan.test";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

type Mods = {
  connect: typeof import("@/lib/db/connect");
  t: typeof import("@/lib/db/schema");
  imp: typeof import("@/lib/outreach/import");
  server: typeof import("@/lib/outreach/server");
  unsub: typeof import("@/lib/outreach/unsubscribe");
  token: typeof import("@/lib/outreach/token");
};
let m: Mods;
const csv = fs.readFileSync(path.resolve(__dirname, "../../docs/outreach/pakistani-brands.csv"), "utf8");

beforeAll(async () => {
  m = {
    connect: await import("@/lib/db/connect"),
    t: await import("@/lib/db/schema"),
    imp: await import("@/lib/outreach/import"),
    server: await import("@/lib/outreach/server"),
    unsub: await import("@/lib/outreach/unsubscribe"),
    token: await import("@/lib/outreach/token"),
  };
});

afterAll(async () => {
  await m.connect.closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("brand outreach (database)", () => {
  it("imports the research CSV idempotently and keeps staff edits", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    // A directory entry and a brand with matching names get linked (links only).
    await db.insert(m.t.brandDirectoryEntries).values({ slug: "khaadi", name: "Khaadi", category: "women_men" });
    await db.insert(m.t.brands).values({ slug: "sapphire", name: "Sapphire" });

    const first = await m.imp.importOutreachCsv(db, csv, "csv_seed");
    expect(first.plan.creates.length).toBeGreaterThan(40);
    const all = await db.select().from(m.t.outreachContacts);
    expect(all).toHaveLength(first.plan.creates.length);
    const khaadi = all.find((c) => c.nameKey === "khaadi")!;
    expect(khaadi.email).toBe("welisten@khaadi.com");
    expect(khaadi.directoryEntryId).not.toBeNull();
    expect(all.find((c) => c.nameKey === "sapphire")!.brandId).not.toBeNull();

    const second = await m.imp.importOutreachCsv(db, csv, "csv_seed");
    expect(second.plan.creates).toHaveLength(0);
    expect(second.plan.updates).toHaveLength(0);
    expect(await db.select().from(m.t.outreachContacts)).toHaveLength(all.length);

    // Staff correct an email and clear a city; a re-import keeps the email and refills only the blank.
    await db.update(m.t.outreachContacts).set({ email: "partners@khaadi.com", city: null, staffEditedAt: new Date() }).where(eq(m.t.outreachContacts.id, khaadi.id));
    const third = await m.imp.importOutreachCsv(db, csv, "csv_upload");
    const after = (await db.query.outreachContacts.findFirst({ where: eq(m.t.outreachContacts.id, khaadi.id) }))!;
    expect(after.email).toBe("partners@khaadi.com");
    expect(after.city).toBe("Karachi");
    expect(third.plan.kept.map((k) => k.brandName)).toContain("Khaadi");
  });

  it("seeds the two default templates once", async () => {
    const db = await m.connect.getDb();
    await m.imp.seedOutreachTemplates(db);
    await m.imp.seedOutreachTemplates(db);
    const rows = await db.select().from(m.t.outreachTemplates);
    expect(rows.map((r) => r.key).sort()).toEqual(["follow_up", "pitch"]);
  });

  it("logs an outreach email to the outbox with the opt-out footer, then the link opts the contact out", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const contact = (await db.query.outreachContacts.findFirst({ where: eq(m.t.outreachContacts.nameKey, "sana-safinaz") }))!;
    const [staff] = await db.insert(m.t.users).values({ email: "staff@wahbayaan.test", name: "Staff", role: "staff" }).returning();
    const sender = { senderName: "Test Sender", senderPhone: "+92 300 0000000", replyTo: "reply@wahbayaan.test", businessAddress: "Lahore, Pakistan" };
    const res = await m.server.deliverOutreachEmail({ contact, subject: "Hello Sana Safinaz", body: "Body", templateId: null, actorId: staff.id, sender, siteUrl: "https://wahbayaan.test" });
    expect(res.deliveryStatus).toBe("logged");

    const outbox = (await db.select().from(m.t.emailOutbox).where(eq(m.t.emailOutbox.template, "outreach")))[0];
    expect(outbox.status).toBe("logged");
    expect(outbox.replyTo).toBe("reply@wahbayaan.test");
    const link = outbox.body.match(/https:\/\/wahbayaan\.test\/outreach\/unsubscribe\?t=(\S+)/)!;
    expect(link).not.toBeNull();

    const updated = (await db.query.outreachContacts.findFirst({ where: eq(m.t.outreachContacts.id, contact.id) }))!;
    expect(updated.status).toBe("contacted");
    expect(updated.nextFollowUpAt!.getTime()).toBeGreaterThan(Date.now() + 4 * 86_400_000);
    const facts = await m.server.loadSendFacts([updated]);
    expect(facts.lastEmailed.get(contact.id)).toBeInstanceOf(Date);

    // Tampered token: nothing changes.
    expect(await m.unsub.unsubscribeByToken(decodeURIComponent(link[1]).slice(0, -3) + "abc")).toBe(false);
    expect((await db.query.outreachContacts.findFirst({ where: eq(m.t.outreachContacts.id, contact.id) }))!.status).toBe("contacted");

    expect(await m.unsub.unsubscribeByToken(decodeURIComponent(link[1]))).toBe(true);
    const gone = (await db.query.outreachContacts.findFirst({ where: eq(m.t.outreachContacts.id, contact.id) }))!;
    expect(gone.status).toBe("do_not_contact");
    expect(gone.nextFollowUpAt).toBeNull();
    const supp = await m.server.loadSendFacts([gone]);
    expect(supp.suppressed.has(gone.email!)).toBe(true);
    // Clicking again is harmless.
    expect(await m.unsub.unsubscribeByToken(decodeURIComponent(link[1]))).toBe(true);
  });
});
