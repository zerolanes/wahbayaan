import "server-only";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { outreachContacts, outreachMessages, outreachSuppressions } from "@/lib/db/schema";
import { normalizeEmail } from "./skip";
import { verifyUnsubscribeToken } from "./token";

/**
 * The ONLY outreach module a public route may use (the opt-out link). It marks
 * the contact do-not-contact, adds its address to the suppression list and
 * answers with a boolean — nothing about the contact ever leaves this function.
 */
export async function unsubscribeByToken(token: string | null | undefined): Promise<boolean> {
  const contactId = verifyUnsubscribeToken(token);
  if (!contactId) return false;
  const d = await db();
  const contact = await d.query.outreachContacts.findFirst({ where: eq(outreachContacts.id, contactId), columns: { id: true, status: true, email: true } });
  if (!contact) return true; // Deleted contact: nothing left to email. Same answer either way.
  const email = normalizeEmail(contact.email);
  if (email) await d.insert(outreachSuppressions).values({ email, source: "unsubscribe", reason: "Opt-out link in an outreach email", contactId: contact.id }).onConflictDoNothing();
  if (contact.status !== "do_not_contact") {
    await d.update(outreachContacts).set({ status: "do_not_contact", nextFollowUpAt: null }).where(eq(outreachContacts.id, contact.id));
    await d.insert(outreachMessages).values({ contactId: contact.id, kind: "unsubscribed", fromStatus: contact.status, toStatus: "do_not_contact", body: "Opted out with the link in an outreach email." });
    await audit({ actorUserId: null, action: "outreach.unsubscribe", entity: "outreach_contact", entityId: contact.id, summary: "Contact opted out with the link in an outreach email (do not contact)" });
  }
  return true;
}
