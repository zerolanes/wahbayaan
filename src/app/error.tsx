"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-xs font-semibold tracking-[0.3em] text-gold-600 uppercase">Something went wrong</p>
        <h1 className="mt-3 font-display text-4xl text-umber-900">We dropped a stitch</h1>
        <p className="mt-3 text-umber-600">An unexpected error happened. Your cart and orders are safe. Please try again.</p>
        {error.digest ? <p className="mt-2 text-xs text-umber-400">Reference {error.digest}</p> : null}
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="inline-flex h-11 items-center rounded-full bg-indigo-900 px-6 font-medium text-sand-50">
            Try again
          </button>
          <Link href="/" className="inline-flex h-11 items-center rounded-full border border-umber-300 px-6">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
