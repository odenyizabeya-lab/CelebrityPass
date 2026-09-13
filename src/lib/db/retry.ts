/**
 * Retries a database operation when Prisma reports a transient pool/transaction
 * error (P2024 "timed out fetching a new connection", P2028 "unable to start a
 * transaction"). Under a momentarily saturated connection pool these errors
 * are expected and safe to retry — the send path is idempotent thanks to the
 * (conversationId, clientId) unique constraint, so a retry can never create a
 * duplicate row.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 300
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string } | null)?.code;
      if (code !== "P2024" && code !== "P2028") throw err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}