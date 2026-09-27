"use client";

import { useActionState, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import type { ActionState, AdminAction } from "@/lib/admin/action-state";
import { cn } from "@/lib/utils/cn";
import { toast } from "./toaster";

/**
 * Form bound to an admin server action via useActionState. Results are shown as
 * a toast, and inline when `inline` is set (for longer forms).
 */
export function ActionForm({
  action,
  children,
  className,
  inline,
  resetOnSuccess,
  confirm,
  id,
  encType,
  onResult,
}: {
  action: AdminAction;
  children: ReactNode;
  className?: string;
  inline?: boolean;
  resetOnSuccess?: boolean;
  confirm?: string;
  id?: string;
  encType?: "multipart/form-data";
  onResult?: (s: ActionState) => void;
}) {
  // Toast from the action itself so feedback survives the form unmounting
  // after refresh() (e.g. a status button that disappears once used).
  const [state, formAction] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await action(prev, fd);
    if (res?.error) toast("error", res.error);
    else if (res?.message) toast("success", res.message);
    return res;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.at) return;
    if (state.ok && resetOnSuccess) ref.current?.reset();
    onResult?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.at]);
  return (
    <form
      ref={ref}
      id={id}
      action={formAction}
      encType={encType}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {inline && state?.at ? <FormFeedback state={state} /> : null}
    </form>
  );
}

export function FormFeedback({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <div className="mt-3 space-y-2" aria-live="polite">
      {state.error ? <p className="rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700">{state.error}</p> : null}
      {state.ok && state.message ? <p className="rounded-xl bg-success-50 px-3 py-2 text-sm text-success-700">{state.message}</p> : null}
      {state.data
        ? Object.entries(state.data).map(([k, v]) => (
            <p key={k} className="rounded-xl border border-gold-300 bg-gold-50 px-3 py-2 text-sm text-gold-900">
              {k}: <code className="font-mono font-semibold select-all">{v}</code>
            </p>
          ))
        : null}
    </div>
  );
}

/** Submit button that shows a spinner while its form's action runs. */
export function SubmitButton({
  children,
  variant = "primary",
  size = "sm",
  className,
  confirm,
  pendingLabel,
  onClick,
  disabled,
  ...props
}: { variant?: ButtonVariant; size?: ButtonSize; confirm?: string; pendingLabel?: string } & ComponentProps<"button">) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...props}
      disabled={pending || disabled}
      className={buttonClass(variant, size, className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
        onClick?.(e);
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Compact one-button form: hidden fields + a submit button. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "outline",
  size = "sm",
  confirm,
  className,
  title,
}: {
  action: AdminAction;
  fields?: Record<string, string | number | null | undefined>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  confirm?: string;
  className?: string;
  title?: string;
}) {
  return (
    <ActionForm action={action} confirm={confirm} className={cn("inline-flex", className)}>
      {Object.entries(fields ?? {}).map(([k, v]) => (v == null ? null : <input key={k} type="hidden" name={k} value={String(v)} />))}
      <SubmitButton variant={variant} size={size} title={title}>
        {children}
      </SubmitButton>
    </ActionForm>
  );
}
