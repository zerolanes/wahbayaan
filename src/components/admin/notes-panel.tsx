import { and, desc, eq } from "drizzle-orm";
import { StickyNote } from "lucide-react";
import { addAdminNote, deleteAdminNote } from "@/app/actions/admin/notes";
import { Textarea } from "@/components/ui/form";
import { db } from "@/lib/db/client";
import { adminNotes, auditLog, users } from "@/lib/db/schema";
import { formatDateTime, timeAgo } from "@/lib/utils/format";
import { ActionButton, ActionForm, SubmitButton } from "./action-form";
import { Panel } from "./ui";

/** Internal notes on any entity (never shown to buyers or artisans). */
export async function NotesPanel({ entity, entityId, currentUserId }: { entity: string; entityId: string; currentUserId: string }) {
  const d = await db();
  const notes = await d
    .select({ id: adminNotes.id, body: adminNotes.body, createdAt: adminNotes.createdAt, authorId: adminNotes.authorId, author: users.name })
    .from(adminNotes)
    .leftJoin(users, eq(users.id, adminNotes.authorId))
    .where(and(eq(adminNotes.entity, entity), eq(adminNotes.entityId, entityId)))
    .orderBy(desc(adminNotes.createdAt));
  return (
    <Panel title={<span className="flex items-center gap-2"><StickyNote className="size-4 text-gold-600" />Admin notes</span>} description="Internal only — never shown to buyers or artisans.">
      <ActionForm action={addAdminNote} resetOnSuccess className="space-y-2">
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="entityId" value={entityId} />
        <Textarea name="body" rows={2} placeholder="Add a note for the team…" className="min-h-16 text-sm" required />
        <div className="flex justify-end">
          <SubmitButton>Add note</SubmitButton>
        </div>
      </ActionForm>
      {notes.length ? (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-gold-50/70 px-3 py-2.5 text-sm ring-1 ring-gold-200/60">
              <p className="whitespace-pre-wrap text-umber-800">{n.body}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-umber-500">
                <span title={formatDateTime(n.createdAt)}>
                  {n.author ?? "Former staff"} · {timeAgo(n.createdAt)}
                </span>
                {n.authorId === currentUserId ? (
                  <ActionButton action={deleteAdminNote} fields={{ id: n.id }} variant="ghost" confirm="Delete this note?" className="-my-1">
                    Delete
                  </ActionButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-umber-500">No notes yet.</p>
      )}
    </Panel>
  );
}

/** Audit entries recorded against an entity. */
export async function AuditTrail({ entity, entityId, limit = 12, title = "Audit trail" }: { entity: string | string[]; entityId: string; limit?: number; title?: string }) {
  const d = await db();
  const entities = Array.isArray(entity) ? entity : [entity];
  const rows = (
    await Promise.all(
      entities.map((e) =>
        d
          .select({ id: auditLog.id, action: auditLog.action, summary: auditLog.summary, createdAt: auditLog.createdAt, actor: users.name })
          .from(auditLog)
          .leftJoin(users, eq(users.id, auditLog.actorUserId))
          .where(and(eq(auditLog.entity, e), eq(auditLog.entityId, entityId)))
          .orderBy(desc(auditLog.createdAt))
          .limit(limit),
      ),
    )
  )
    .flat()
    .sort((a, b) => +b.createdAt - +a.createdAt)
    .slice(0, limit);
  return (
    <Panel title={title} description="Every staff change is recorded.">
      {rows.length ? (
        <ol className="relative space-y-3 border-l border-umber-200 pl-4">
          {rows.map((r) => (
            <li key={r.id} className="text-sm">
              <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-sand-50 bg-indigo-400" />
              <p className="text-umber-800">{r.summary}</p>
              <p className="text-xs text-umber-500" title={formatDateTime(r.createdAt)}>
                {r.actor ?? "System"} · <code className="text-[11px]">{r.action}</code> · {timeAgo(r.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-umber-500">No staff changes recorded yet.</p>
      )}
    </Panel>
  );
}
