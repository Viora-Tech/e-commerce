import { connection } from 'next/server'

/**
 * The bare 404 for paths outside any store segment (`/api/…` that matches no route, say).
 * Rendered per request, never prerendered: the proxy sends a nonce script CSP with every
 * answer, and a static page's scripts carry no nonce, so the browser would refuse them.
 */
export default async function NotFound() {
  // Hooks
  await connection()

  // Render logic
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', padding: 32 }}>
        <h1>Not found</h1>
      </body>
    </html>
  )
}
