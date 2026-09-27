"use server";

import { z } from "zod";
import { runAutoReleases } from "@/lib/commerce/orders";
import { adminAction } from "@/lib/admin/action";

export const runAutoReleasesAction = adminAction("escrow.release", z.object({}), async ({ audit }) => {
  const n = await runAutoReleases();
  await audit({ action: "escrow.auto_release", entity: "system", summary: `Ran auto-release: ${n} order${n === 1 ? "" : "s"} released` });
  return { message: n ? `Released funds on ${n} order${n === 1 ? "" : "s"}` : "Nothing was due for release" };
});
