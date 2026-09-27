import Image from "next/image";
import type { ReactNode } from "react";
import { StarMark } from "@/components/brand/logo";

export function AuthShell({ title, subtitle, children, art = "/art/calligraphy/8-wide.svg" }: { title: string; subtitle: string; children: ReactNode; art?: string }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
      <div className="night relative hidden overflow-hidden rounded-[2rem] md:block">
        <Image src={art} alt="" fill unoptimized className="object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950 via-indigo-950/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <StarMark className="size-10" />
          <p className="mt-4 font-display text-3xl text-sand-50">Every piece carries a maker&apos;s name.</p>
          <p className="mt-2 text-sand-200/80">Verified artisans. Payment held until delivery. Landed cost before you pay.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <h1 className="font-display text-4xl text-umber-900">{title}</h1>
        <p className="mt-2 mb-8 text-umber-600">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
