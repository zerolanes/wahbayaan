"use client";

import { useActionState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import type { ActionState } from "@/app/actions/seller";
import { cn } from "@/lib/utils/cn";

/** Form bound to a `(prev, formData) => ActionState` server action, with inline feedback. Usable from Server Components. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={cn("space-y-4", className)}>
      {state?.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state?.ok && state.message ? <Notice tone="success">{state.message}</Notice> : null}
      {children}
    </form>
  );
}

/** Submit button that disables itself (and optionally relabels) while its form is submitting. */
export function SubmitButton({ pendingLabel, children, ...props }: ComponentProps<typeof Button> & { pendingLabel?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
