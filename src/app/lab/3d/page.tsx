import { notFound } from "next/navigation";
import { ProductViewer3D } from "@/components/three/product-viewer";

/** Development-only 3D object lab: /lab/3d?kind=rug&seed=4&w=183&h=274&d=1 */
export default async function Lab3d(props: PageProps<"/lab/3d">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await props.searchParams;
  const kind = typeof sp.kind === "string" ? sp.kind : "rug";
  const seed = Number(sp.seed ?? 4);
  const num = (v: unknown) => (typeof v === "string" && v ? Number(v) : null);
  return (
    <div style={{ height: "100vh" }}>
      <ProductViewer3D model={{ source: "procedural", kind, seed }} dims={{ widthCm: num(sp.w), heightCm: num(sp.h), depthCm: num(sp.d) }} title={kind} />
    </div>
  );
}
