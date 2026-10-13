import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseOutreachCsv, planOutreachImport, type ExistingContact } from "@/lib/outreach/csv";
import { DEFAULT_OUTREACH_TEMPLATES } from "@/lib/outreach/defaults";
import { composeOutreachEmail, emptyFieldsUsed, mergeVars, renderTemplate, unresolvedFields, withFooter } from "@/lib/outreach/merge";
import { statusAfterEvent, isFollowUpDue } from "@/lib/outreach/pipeline";
import { isHardBlock, skipReason } from "@/lib/outreach/skip";
import { createUnsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from "@/lib/outreach/token";

const HEADER = "brand,category,website,email,email_type,phone,instagram,city,ships_internationally,source_url,notes";
const sender = { senderName: "Ayesha Khan", senderPhone: "+92 300 1234567", replyTo: "ayesha@wahbayaan.com", businessAddress: "Lahore, Pakistan" };

describe("outreach CSV import", () => {
  const csv = `${HEADER}
Alpha Lawn,women,alpha.pk,Info@Alpha.pk,customer care,0300 0000000,@alpha,Lahore,yes,https://alpha.pk/contact,"Note, with comma"
Beta Studio,men,https://beta.pk,,,,,Karachi,,,
,women,https://nobrand.pk,x@y.pk,,,,,,,
alpha lawn,women,https://dup.pk,dup@dup.pk,,,,,,,`;

  it("parses rows, normalises email and website, skips blanks and duplicates", () => {
    const { rows, issues, error } = parseOutreachCsv(csv);
    expect(error).toBeUndefined();
    expect(rows.map((r) => r.brandName)).toEqual(["Alpha Lawn", "Beta Studio"]);
    expect(rows[0].fields).toMatchObject({ email: "info@alpha.pk", websiteUrl: "https://alpha.pk", notes: "Note, with comma", city: "Lahore" });
    expect(rows[1].fields.email).toBeUndefined();
    expect(issues).toHaveLength(2);
    expect(issues[1].message).toMatch(/same brand as line 2/);
  });

  it("refuses a file without a brand column", () => {
    expect(parseOutreachCsv("name_of_thing,email\nx,y@z.pk").error).toMatch(/brand/);
  });

  it("is idempotent: a second run of the same file changes nothing", () => {
    const { rows } = parseOutreachCsv(csv);
    const first = planOutreachImport([], rows);
    expect(first.creates).toHaveLength(2);
    const existing: ExistingContact[] = first.creates.map((r, i) => ({ id: `id-${i}`, nameKey: r.nameKey, staffEditedAt: null, ...r.fields }));
    const second = planOutreachImport(existing, rows);
    expect(second).toEqual({ creates: [], updates: [], unchanged: 2, kept: [] });
  });

  it("refreshes untouched rows but never clobbers staff edits (only fills blanks)", () => {
    const { rows } = parseOutreachCsv(csv);
    const existing: ExistingContact[] = [
      { id: "a", nameKey: "alpha-lawn", staffEditedAt: new Date(), email: "owner@alpha.pk", city: null, phone: "edited" },
      { id: "b", nameKey: "beta-studio", staffEditedAt: null, city: "Old city", websiteUrl: null },
    ];
    const plan = planOutreachImport(existing, rows);
    const a = plan.updates.find((u) => u.id === "a")!;
    expect(a.patch.email).toBeUndefined();
    expect(a.patch.phone).toBeUndefined();
    expect(a.patch.city).toBe("Lahore");
    expect(plan.kept).toEqual([{ id: "a", brandName: "Alpha Lawn", fields: ["email", "phone"] }]);
    const b = plan.updates.find((u) => u.id === "b")!;
    expect(b.patch).toEqual({ category: "men", websiteUrl: "https://beta.pk", city: "Karachi" });
  });

  it("a blank cell never wipes existing data", () => {
    const { rows } = parseOutreachCsv(`${HEADER}\nBeta Studio,,,,,,,,,,`);
    const plan = planOutreachImport([{ id: "b", nameKey: "beta-studio", staffEditedAt: null, email: "keep@beta.pk" }], rows);
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toBe(1);
  });

  it("reads the research file in docs/outreach", () => {
    const text = fs.readFileSync(path.resolve(__dirname, "../docs/outreach/pakistani-brands.csv"), "utf8");
    const { rows, error } = parseOutreachCsv(text);
    expect(error).toBeUndefined();
    expect(rows.length).toBeGreaterThan(40);
    expect(new Set(rows.map((r) => r.nameKey)).size).toBe(rows.length);
  });
});

describe("outreach merge fields", () => {
  it("fills every field and falls back to “{brand} team”", () => {
    const vars = mergeVars({ brandName: "Khaadi", contactName: null }, sender, "https://wahbayaan.com/");
    expect(renderTemplate("Hi {name} at {brand} — {sender_name} {sender_phone} {site_url}", vars)).toBe("Hi Khaadi team at Khaadi — Ayesha Khan +92 300 1234567 https://wahbayaan.com");
    expect(mergeVars({ brandName: "Khaadi", contactName: "Sara" }, sender, "x").name).toBe("Sara");
  });

  it("leaves unknown fields visible and reports them", () => {
    const vars = mergeVars({ brandName: "B" }, sender, "s");
    expect(renderTemplate("{brnad} {brand}", vars)).toBe("{brnad} B");
    expect(unresolvedFields("{brnad} {brand} {foo}")).toEqual(["brnad", "foo"]);
  });

  it("reports merge fields that render empty", () => {
    const vars = mergeVars({ brandName: "B" }, { ...sender, senderPhone: null }, "s");
    expect(emptyFieldsUsed("call {sender_phone} {brand}", vars)).toEqual(["sender_phone"]);
  });

  it("default templates use only known fields and render cleanly", () => {
    for (const tpl of DEFAULT_OUTREACH_TEMPLATES) {
      expect(unresolvedFields(`${tpl.subject}\n${tpl.body}`)).toEqual([]);
      const out = composeOutreachEmail({ template: tpl, contact: { brandName: "Sana Safinaz" }, sender, siteUrl: "https://wahbayaan.com", unsubscribeUrl: "https://wahbayaan.com/outreach/unsubscribe?t=abc" });
      expect(out.subject).toContain("Sana Safinaz");
      expect(out.body).not.toMatch(/\{[a-z_]+\}/);
      expect(out.body).toContain("Assalam-o-alaikum Sana Safinaz team");
      expect(out.body).not.toMatch(/US\/UK/);
    }
  });

  it("every email ends with the business identity and the opt-out link", () => {
    const out = composeOutreachEmail({ template: { subject: "s", body: "Hello" }, contact: { brandName: "B" }, sender, siteUrl: "https://wahbayaan.com", unsubscribeUrl: "https://wahbayaan.com/outreach/unsubscribe?t=tok" });
    const text = withFooter(out.body, out.footer);
    expect(text.startsWith("Hello\n\n—\nWahbayaan · Lahore, Pakistan · https://wahbayaan.com")).toBe(true);
    expect(text).toContain("https://wahbayaan.com/outreach/unsubscribe?t=tok");
  });
});

describe("outreach skip rules", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const none = new Set<string>();
  const base = { status: "contacted", email: "a@brand.pk" };

  it("allows a normal contact", () => {
    expect(skipReason(base, { suppressed: none, lastEmailedAt: null, now })).toBeNull();
  });

  it("skips do-not-contact, suppressed, missing and invalid email", () => {
    expect(skipReason({ ...base, status: "do_not_contact" }, { suppressed: none, lastEmailedAt: null, now })?.code).toBe("do_not_contact");
    expect(skipReason({ ...base, email: "A@Brand.pk" }, { suppressed: new Set(["a@brand.pk"]), lastEmailedAt: null, now })?.code).toBe("suppressed");
    expect(skipReason({ ...base, email: null }, { suppressed: none, lastEmailedAt: null, now })?.code).toBe("no_email");
    expect(skipReason({ ...base, email: "not an email" }, { suppressed: none, lastEmailedAt: null, now })?.code).toBe("invalid_email");
  });

  it("skips contacts emailed in the last 5 days (soft block)", () => {
    const r = skipReason(base, { suppressed: none, lastEmailedAt: new Date(now.getTime() - 2 * 86_400_000), now });
    expect(r?.code).toBe("recently_emailed");
    expect(r?.message).toMatch(/2 days ago/);
    expect(isHardBlock(r)).toBe(false);
    expect(skipReason(base, { suppressed: none, lastEmailedAt: new Date(now.getTime() - 5 * 86_400_000), now })).toBeNull();
  });

  it("hard blocks win over the 5-day rule", () => {
    const r = skipReason({ ...base, status: "do_not_contact" }, { suppressed: none, lastEmailedAt: now, now });
    expect(isHardBlock(r)).toBe(true);
  });
});

describe("outreach pipeline", () => {
  it("moves forward only, never out of closed statuses", () => {
    expect(statusAfterEvent("new", "email")).toBe("contacted");
    expect(statusAfterEvent("replied", "email")).toBe("replied");
    expect(statusAfterEvent("contacted", "replied")).toBe("replied");
    expect(statusAfterEvent("replied", "call_booked")).toBe("call_booked");
    expect(statusAfterEvent("agreed", "replied")).toBe("agreed");
    expect(statusAfterEvent("do_not_contact", "email")).toBe("do_not_contact");
    expect(statusAfterEvent("new", "note")).toBe("new");
  });

  it("follow-ups are due only for open contacts", () => {
    const past = new Date(Date.now() - 1000);
    expect(isFollowUpDue({ status: "contacted", nextFollowUpAt: past })).toBe(true);
    expect(isFollowUpDue({ status: "agreed", nextFollowUpAt: past })).toBe(false);
    expect(isFollowUpDue({ status: "contacted", nextFollowUpAt: null })).toBe(false);
  });
});

describe("outreach unsubscribe token", () => {
  const id = "3f2b9c1e-8d4a-4f6b-9a1c-2e7d5b8a0c11";

  it("verifies a genuine token", () => {
    expect(verifyUnsubscribeToken(createUnsubscribeToken(id, "s3cret"), "s3cret")).toBe(id);
    expect(unsubscribeUrl("https://wahbayaan.com/", id)).toMatch(/^https:\/\/wahbayaan\.com\/outreach\/unsubscribe\?t=/);
  });

  it("rejects tampered, swapped, truncated and foreign-key tokens", () => {
    const tok = createUnsubscribeToken(id, "s3cret");
    const [, sig] = tok.split(".");
    const other = "00000000-0000-4000-8000-000000000000";
    expect(verifyUnsubscribeToken(`${other}.${sig}`, "s3cret")).toBeNull();
    expect(verifyUnsubscribeToken(`${tok.slice(0, -2)}xx`, "s3cret")).toBeNull();
    expect(verifyUnsubscribeToken(id, "s3cret")).toBeNull();
    expect(verifyUnsubscribeToken(`${tok}.extra`, "s3cret")).toBeNull();
    expect(verifyUnsubscribeToken(tok, "another-secret")).toBeNull();
    expect(verifyUnsubscribeToken("", "s3cret")).toBeNull();
    expect(verifyUnsubscribeToken(null)).toBeNull();
  });
});
