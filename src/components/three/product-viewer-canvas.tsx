"use client";

import type { ProductViewerProps } from "./product-viewer";

// Placeholder until the 3D object library lands; replaced in the 3D commit.
export function ProductViewerCanvas({ title, className }: ProductViewerProps) {
  return (
    <div className={`grid h-full w-full place-items-center bg-indigo-950 text-sm text-sand-200/70 ${className ?? ""}`}>
      3D view of “{title}” coming soon
    </div>
  );
}
