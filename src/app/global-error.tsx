"use client";

/**
 * Global error boundary — the very last safety net. Only used when even the
 * root layout fails. Renders a minimal self-contained page (must include its
 * own <html>/<body>) with a single Try again action.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#0b0c10",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            padding: 36,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div
            style={{
              margin: "0 auto",
              width: 44,
              height: 44,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(124,58,237,0.2)",
              color: "#c4b5fd",
              fontWeight: 900,
              fontSize: 20,
            }}
            aria-hidden
          >
            !
          </div>
          <h1 style={{ fontSize: 20, margin: "16px 0 8px" }}>CelebrityPass hit a snag</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa", margin: 0 }}>
            Something unexpected went wrong. Your data is safe — try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: "10px 28px",
              borderRadius: 999,
              border: 0,
              background: "linear-gradient(90deg,#7c3aed,#d946ef)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}