import { cn } from "@/lib/utils/cn";

export const isSvg = (url: string | null | undefined) => !!url && url.split("?")[0].endsWith(".svg");

/** Small label for procedural artwork so it's never mistaken for a photograph of the piece. */
export function IllustrationTag({ className, label = "Illustration" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn("rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-white/90 backdrop-blur", className)}
      title="Illustration standing in for real photography"
    >
      {label}
    </span>
  );
}
