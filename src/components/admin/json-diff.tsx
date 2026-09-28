import { auditDiff, type DiffEntry } from "@/lib/admin/diff";
import { cn } from "@/lib/utils/cn";

function Val({ v, tone }: { v: unknown; tone: "before" | "after" }) {
  if (v === undefined) return <span className="text-umber-400">—</span>;
  const s = typeof v === "string" ? v : JSON.stringify(v, null, 1);
  return <code className={cn("rounded px-1 py-0.5 text-xs break-all whitespace-pre-wrap", tone === "before" ? "bg-danger-50 text-danger-700" : "bg-success-50 text-success-700")}>{s === "" ? '""' : s}</code>;
}

export function DiffTable({ entries }: { entries: DiffEntry[] }) {
  if (!entries.length) return <p className="text-xs text-umber-500">Before and after are identical.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-umber-500">
          <th className="w-1/4 py-1 pr-3 font-medium">Field</th>
          <th className="py-1 pr-3 font-medium">Before</th>
          <th className="py-1 font-medium">After</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-umber-200/60">
        {entries.map((e) => (
          <tr key={e.path} className="align-top">
            <td className="py-1.5 pr-3">
              <code className="text-xs text-umber-800">{e.path}</code>
              {e.kind !== "changed" ? <span className="ml-1.5 text-[11px] text-umber-500">{e.kind}</span> : null}
            </td>
            <td className="py-1.5 pr-3">
              <Val v={e.before} tone="before" />
            </td>
            <td className="py-1.5">
              <Val v={e.after} tone="after" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Audit payload viewer: a field diff for `{ before, after }`, raw JSON otherwise. */
export function AuditData({ data }: { data: unknown }) {
  if (data == null) return <p className="text-xs text-umber-500">No data was recorded with this entry.</p>;
  const diff = auditDiff(data);
  return (
    <div className="space-y-3">
      {diff ? <DiffTable entries={diff} /> : null}
      <details open={!diff}>
        <summary className="cursor-pointer text-xs text-umber-500 hover:text-umber-900">Raw JSON</summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-white p-3 text-xs text-umber-800 ring-1 ring-umber-200">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}
