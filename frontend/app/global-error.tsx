"use client";

/**
 * Last resort: replaces the whole page if the root layout itself fails. It can't rely on
 * the app's CSS, so it styles itself inline.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbfaf8", color: "#1f2433" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Something went wrong</h1>
            <p style={{ margin: "0 0 20px", lineHeight: 1.5 }}>
              The app couldn&apos;t load. Your saved answers are safe on this device. Please try again.
            </p>
            <button
              onClick={reset}
              style={{ height: 48, padding: "0 28px", border: 0, borderRadius: 999, background: "#015746", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
