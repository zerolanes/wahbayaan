import { marked } from "marked";
import { cn } from "@/lib/utils/cn";

/**
 * Renders admin-authored Markdown (journal posts, policy pages) in the
 * heritage prose style. Content comes only from staff-edited tables.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = marked.parse(source, { async: false, gfm: true }) as string;
  // Strip anything script-like defensively; staff content should never need it.
  const safe = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son\w+="[^"]*"/gi, "");
  return <div className={cn("prose-heritage", className)} dangerouslySetInnerHTML={{ __html: safe }} />;
}
