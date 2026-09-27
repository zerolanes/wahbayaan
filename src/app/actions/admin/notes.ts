"use server";

import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { adminNotes } from "@/lib/db/schema";
import type { ActionState } from "@/lib/admin/action-state";
import { NOTE_ENTITIES } from "@/lib/admin/entities";
import { firstIssue, formToObject } from "@/lib/admin/zod";

const addSchema = z.object({
  entity: z.string().refine((e) => e in NOTE_ENTITIES, "Unknown entity"),
  entityId: z.string().min(1).max(100),
  body: z.string().trim().min(1, "Write a note first").max(5000),
});

export async function addAdminNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = addSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error), at: Date.now() };
  const { entity, entityId, body } = parsed.data;
  const user = await getCurrentUser();
  const perm = NOTE_ENTITIES[entity].permission;
  if (!user || user.role !== "staff" || !user.permissions.has(perm)) return { error: `Your role doesn't include “${perm}”.`, at: Date.now() };
  const d = await db();
  const [note] = await d.insert(adminNotes).values({ entity, entityId, body, authorId: user.id }).returning();
  await audit({ actorUserId: user.id, action: "note.add", entity, entityId, summary: `Added an internal note`, data: { noteId: note.id } });
  refresh();
  return { ok: true, message: "Note added", at: Date.now() };
}

export async function deleteAdminNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  const user = await getCurrentUser();
  if (!user || user.role !== "staff") return { error: "Not allowed", at: Date.now() };
  const d = await db();
  const note = await d.query.adminNotes.findFirst({ where: eq(adminNotes.id, id) });
  if (!note) return { error: "Note not found", at: Date.now() };
  if (note.authorId !== user.id && !user.permissions.has("staff.manage")) return { error: "Only the author (or an admin with staff.manage) can delete this note.", at: Date.now() };
  await d.delete(adminNotes).where(and(eq(adminNotes.id, id)));
  await audit({ actorUserId: user.id, action: "note.delete", entity: note.entity, entityId: note.entityId, summary: "Deleted an internal note", data: { body: note.body } });
  refresh();
  return { ok: true, message: "Note deleted", at: Date.now() };
}
