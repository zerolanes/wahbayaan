import Image from "next/image";
import type { ReactNode } from "react";
import { StarMark } from "@/components/brand/logo";

export function AuthShell({ title, subtitle, children, art = "/art/calligraphy/8-wide.svg" }: { title: string; subtitle: string; children: ReactNode; art?: string }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-6 pb-12 md:grid-cols-2 md:gap-8 md:py-14">
      <div className="night relative hidden min-h-[36rem] overflow-hidden rounded-[var(--radius-sheet)] md:block">
        <Image src={art} alt="" fill unoptimized className="object-cover" />
        <div className="glass-dark absolute inset-x-4 bottom-4 rounded-[1.5rem] p-7">
          <StarMark className="size-9" />
          <p className="mt-4 font-display text-2xl tracking-[-0.025em] text-sand-50">Every piece carries a maker&apos;s name.</p>
          <p className="mt-2 text-sand-100">Verified artisans. Payment held until delivery. Landed cost before you pay.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center rounded-[var(--radius-sheet)] bg-sand-50 p-6 shadow-[0_0_0_0.5px_rgb(34_26_19/0.1),0_12px_32px_-20px_rgb(34_26_19/0.3)] sm:p-10">
        <h1 className="font-display text-3xl tracking-[-0.03em] text-umber-900 md:text-4xl">{title}</h1>
        <p className="mt-2 mb-8 text-umber-700">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
