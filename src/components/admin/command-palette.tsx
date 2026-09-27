"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Keyboard, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type PaletteLink = { href: string; label: string; group: string };
type Result = { type: string; label: string; sublabel?: string; href: string };

const GO: Record<string, string> = {
  d: "/admin",
  o: "/admin/orders",
  q: "/admin/quotes",
  e: "/admin/escrow",
  x: "/admin/disputes",
  a: "/admin/artisans",
  l: "/admin/listings",
  c: "/admin/customers",
  r: "/admin/reports",
  p: "/admin/payouts",
  s: "/admin/settings",
  i: "/admin/inbox",
};

const SHORTCUTS: [string, string][] = [
  ["⌘ K / Ctrl K", "Open the command palette"],
  ["/", "Focus the page search (or open the palette)"],
  ["?", "Show keyboard shortcuts"],
  ["g d", "Dashboard"],
  ["g o", "Orders"],
  ["g q", "Quotes to send"],
  ["g e", "Escrow & payments"],
  ["g x", "Disputes"],
  ["g a", "Artisans"],
  ["g l", "Listings"],
  ["g c", "Customers"],
  ["g p", "Payouts"],
  ["g i", "Support inbox"],
  ["g r", "Reports"],
  ["g s", "Settings"],
];

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

/** ⌘K command palette + global keyboard shortcuts for the admin panel. */
export function CommandPalette({ links }: { links: PaletteLink[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        setHelp(false);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>("input[data-admin-search]");
        if (search) search.focus();
        else setOpen(true);
      } else if (e.key === "?") {
        setHelp((h) => !h);
      } else if (e.key === "g") {
        pendingG = Date.now();
      } else if (pendingG && Date.now() - pendingG < 1200 && GO[e.key]) {
        pendingG = 0;
        router.push(GO[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/admin/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setResults((await res.json()).results as Result[]);
      } catch {
        // aborted or offline — keep page results only
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const pageHits = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? links.filter((l) => `${l.label} ${l.group}`.toLowerCase().includes(term)) : links.slice(0, 8);
    return list.slice(0, 8).map((l) => ({ type: "Page", label: l.label, sublabel: l.group, href: l.href }) satisfies Result);
  }, [q, links]);
  const all = [...pageHits, ...results];

  const go = (r: Result | undefined) => {
    if (!r) return;
    setOpen(false);
    router.push(r.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-72 items-center gap-2 rounded-full border border-umber-200 bg-white/70 px-3 text-sm text-umber-500 hover:border-umber-400 print:hidden"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Search or jump to…</span>
        <kbd className="rounded-md border border-umber-200 bg-sand-100 px-1.5 text-[11px] text-umber-500">⌘K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-indigo-950/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal aria-label="Command palette" className="w-full max-w-xl overflow-hidden rounded-2xl border border-umber-200 bg-sand-50 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-umber-200 px-4">
              <Search className="size-4 text-umber-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, all.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    go(all[active]);
                  }
                }}
                placeholder="Order number, artisan, listing, customer, or a page…"
                className="h-13 flex-1 bg-transparent text-[15px] text-umber-900 placeholder:text-umber-400 focus:outline-none"
                aria-label="Search"
              />
              {loading ? <span className="text-xs text-umber-400">Searching…</span> : null}
            </div>
            <ul className="max-h-[55vh] overflow-y-auto p-2" role="listbox">
              {all.length ? (
                all.map((r, i) => (
                  <li key={`${r.type}-${r.href}-${i}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm", i === active ? "bg-gold-100/70 text-umber-900" : "text-umber-700")}
                    >
                      <span className="w-16 shrink-0 text-[11px] font-medium tracking-wide text-umber-400 uppercase">{r.type}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {r.label}
                        {r.sublabel ? <span className="ml-2 text-umber-400">{r.sublabel}</span> : null}
                      </span>
                      {i === active ? <CornerDownLeft className="size-3.5 text-umber-400" /> : null}
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-6 text-center text-sm text-umber-500">{q.trim().length < 2 ? "Type at least two characters to search records." : "No matches."}</li>
              )}
            </ul>
            <div className="flex items-center justify-between border-t border-umber-200 px-4 py-2 text-[11px] text-umber-400">
              <span>↑↓ to move · Enter to open · Esc to close</span>
              <button type="button" className="flex items-center gap-1 hover:text-umber-700" onClick={() => { setOpen(false); setHelp(true); }}>
                <Keyboard className="size-3.5" /> Shortcuts
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {help ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-indigo-950/40 p-4 backdrop-blur-sm" onClick={() => setHelp(false)}>
          <div role="dialog" aria-modal aria-label="Keyboard shortcuts" className="w-full max-w-md rounded-2xl border border-umber-200 bg-sand-50 p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-umber-900">Keyboard shortcuts</h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>
                    <kbd className="rounded-md border border-umber-200 bg-white px-1.5 py-0.5 font-mono text-xs text-umber-700">{k}</kbd>
                  </dt>
                  <dd className="text-umber-700">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </>
  );
}
