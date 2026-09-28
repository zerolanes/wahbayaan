"use client";

import { useState } from "react";
import { marked } from "marked";
import { cn } from "@/lib/utils/cn";

/** Markdown textarea with Write / Preview / Split modes. Preview uses the same parser as the storefront. */
export function MarkdownEditor({ name, defaultValue = "", rows = 18, placeholder }: { name: string; defaultValue?: string; rows?: number; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"write" | "preview" | "split">("split");
  const html = (marked.parse(value || "_Nothing to preview yet._", { async: false, gfm: true }) as string).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div className="overflow-hidden rounded-xl border border-umber-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-umber-200 bg-umber-50 px-3 py-1.5">
        <div className="flex gap-1 text-xs" role="tablist" aria-label="Editor mode">
          {(["write", "split", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn("rounded-md px-2.5 py-1 capitalize", mode === m ? "bg-white font-medium text-umber-900 shadow-sm ring-1 ring-umber-200" : "text-umber-500 hover:text-umber-900")}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-xs text-umber-500 tabular-nums">
          Markdown · {words} word{words === 1 ? "" : "s"} · ~{Math.max(1, Math.round(words / 220))} min read
        </span>
      </div>
      <div className={cn("grid", mode === "split" && "lg:grid-cols-2")}>
        <textarea
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          placeholder={placeholder ?? "## Heading\n\nWrite in Markdown — **bold**, _italic_, [links](https://…), lists and > quotes."}
          aria-label="Content (Markdown)"
          className={cn("w-full resize-y border-0 bg-white px-4 py-3 font-mono text-[13px] leading-relaxed text-umber-900 focus:ring-0 focus:outline-none", mode === "preview" && "hidden", mode === "split" && "lg:border-r lg:border-umber-200")}
        />
        {mode !== "write" ? (
          <div
            className="max-h-[36rem] overflow-y-auto px-5 py-4 text-sm leading-relaxed text-umber-800 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-umber-300 [&_blockquote]:pl-3 [&_blockquote]:text-umber-600 [&_code]:rounded [&_code]:bg-umber-100 [&_code]:px-1 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_hr]:my-4 [&_img]:rounded-lg [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-umber-200 [&_td]:px-2 [&_th]:border [&_th]:border-umber-200 [&_th]:px-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}
      </div>
    </div>
  );
}
