import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const { next } = await props.searchParams;
  return (
    <AuthShell title="Create your account" subtitle="Save pieces, commission artisans and follow your order from workshop to door." art="/art/rug/28-wide.svg">
      <RegisterForm next={typeof next === "string" ? next : undefined} />
    </AuthShell>
  );
}
