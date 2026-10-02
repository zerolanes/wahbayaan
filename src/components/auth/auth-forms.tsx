"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, requestPasswordReset, resetPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next ?? ""} />
      {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <p className="-mt-3 text-right text-sm">
        <Link href="/forgot-password" className="text-umber-600 underline-offset-4 hover:text-umber-900 hover:underline">
          Forgot your password?
        </Link>
      </p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-umber-600">
        New to Wahbayaan?{" "}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-terracotta-600 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(register, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next ?? ""} />
      {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}
      <Field label="Full name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required defaultValue={state?.fields?.name} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Where will you ship to?" htmlFor="country">
        <Select id="country" name="country" defaultValue="US">
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="CA">Canada</option>
        </Select>
      </Field>
      <Checkbox name="marketing" label="Send me stories from the workshops and early access to limited drops." />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-umber-600">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-terracotta-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state?.ok)
    return (
      <div className="space-y-5">
        <Notice tone="success">{state.message}</Notice>
        <p className="text-sm text-umber-600">Nothing arrived? Check your spam folder, or ask again in a few minutes.</p>
        <Link href="/login" className="text-sm font-medium text-terracotta-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  return (
    <form action={action} className="space-y-5">
      {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a reset link"}
      </Button>
      <p className="text-center text-sm text-umber-600">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-terracotta-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state?.error ? (
        <Notice tone="danger">
          {state.error}{" "}
          {/expired|used/.test(state.error) ? (
            <Link href="/forgot-password" className="font-medium underline">
              Get a new link
            </Link>
          ) : null}
        </Notice>
      ) : null}
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Type it again" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Set new password and sign in"}
      </Button>
      <p className="text-center text-xs text-umber-500">This signs you out on every other device.</p>
    </form>
  );
}
