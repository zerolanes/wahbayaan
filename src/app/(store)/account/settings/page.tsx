import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/store/account-forms";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import { logout } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function SettingsPage() {
  const user = await requireUser("/account/settings");
  const d = await db();
  const row = await d.query.users.findFirst({ where: eq(users.id, user.id) });
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Your account" title="Settings" description={`Signed in as ${user.email}.`} />
      <section className="rounded-[var(--radius-card)] bg-sand-50 p-6 ring-1 ring-umber-200/60 md:p-8">
        <h2 className="font-display text-2xl text-umber-900">Profile</h2>
        <div className="mt-5">
          <ProfileForm name={row?.name ?? user.name} country={row?.country ?? null} marketing={row?.marketingOptIn ?? false} />
        </div>
      </section>
      <section className="rounded-[var(--radius-card)] bg-sand-50 p-6 ring-1 ring-umber-200/60 md:p-8">
        <h2 className="font-display text-2xl text-umber-900">Password</h2>
        <div className="mt-5">
          <PasswordForm />
        </div>
      </section>
      <form action={logout}>
        <button className="text-sm font-medium text-umber-600 underline-offset-4 hover:text-umber-900 hover:underline">Sign out of this device</button>
      </form>
    </div>
  );
}
