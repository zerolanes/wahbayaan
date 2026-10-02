import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      {typeof token === "string" && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Notice tone="danger">
          This link is incomplete. Open the link from your email again, or{" "}
          <Link href="/forgot-password" className="font-medium underline">
            ask for a new one
          </Link>
          .
        </Notice>
      )}
    </AuthShell>
  );
}
