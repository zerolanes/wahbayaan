/** Result of an admin server action, consumed by `useActionState` forms. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  /** Changes on every result so identical messages still trigger feedback. */
  at?: number;
  /** Optional payload, e.g. a generated password shown once. */
  data?: Record<string, string>;
} | null;

export type AdminAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
