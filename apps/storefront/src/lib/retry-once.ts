/** Wait before the second try: long enough for a passing proxy or network hiccup to clear. */
const RETRY_MS = 600

/**
 * Run a checkout lookup (a server action) again once if it fails. The shipping and GST checks
 * fire on their own as the page loads; one dropped request (a 503 from the proxy now and then)
 * should not leave the summary without its numbers. The second failure is the caller's.
 */
export async function retryOnce<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch {
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
    return run()
  }
}
