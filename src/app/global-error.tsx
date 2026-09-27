"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0d1124", color: "#f5eee2", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div>
          <h1 style={{ fontWeight: 400, fontSize: 36 }}>Wahbayaan is having a moment</h1>
          <p style={{ opacity: 0.75 }}>Please try again in a few seconds.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 22px", borderRadius: 999, border: 0, background: "#d4ac5a", color: "#15192e", fontSize: 16 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
