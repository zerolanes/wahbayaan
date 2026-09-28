import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { Notice } from "@/components/ui/misc";
import { SHOW_QA_LABELS } from "@/lib/qa";
import { isDemoMode } from "@/lib/settings";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to track orders, saved pieces and commissions.">
      <LoginForm next={typeof next === "string" ? next : undefined} />
      {SHOW_QA_LABELS && isDemoMode() ? (
        <Notice tone="pending" className="mt-8" title="Demo accounts">
          Password <code>wahbayaan-demo</code> — buyer@wahbayaan.test · admin@wahbayaan.test · noor-calligraphy-atelier@artisans.wahbayaan.test
        </Notice>
      ) : null}
    </AuthShell>
  );
}
