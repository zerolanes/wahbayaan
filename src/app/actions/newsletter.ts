"use server";

import { z } from "zod";
import { db } from "@/lib/db/client";
import { newsletterSubscribers } from "@/lib/db/schema";

export async function subscribeNewsletter(_prev: unknown, formData: FormData) {
  const parsed = z.object({ email: z.email(), source: z.string().max(40).optional() }).safeParse({
    email: formData.get("email"),
    source: formData.get("source") ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: "Please enter a valid email." };
  const d = await db();
  await d
    .insert(newsletterSubscribers)
    .values({ email: parsed.data.email.toLowerCase(), source: parsed.data.source })
    .onConflictDoUpdate({ target: newsletterSubscribers.email, set: { status: "subscribed" } });
  return { ok: true, message: "Thank you — the first story is on its way." };
}
