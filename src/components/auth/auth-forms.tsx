"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions/auth";
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
