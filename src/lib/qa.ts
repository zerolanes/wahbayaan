/**
 * Internal QA labels ("Illustration", "Demo content" ribbon) help the team tell
 * sample content from real content. They are never shown to customers: they
 * only render when the build sets NEXT_PUBLIC_WB_QA_LABELS=1 (inlined at build
 * time, so it works in server and client components alike).
 */
export const SHOW_QA_LABELS = process.env.NEXT_PUBLIC_WB_QA_LABELS === "1";
