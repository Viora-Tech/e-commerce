import { notFound } from 'next/navigation'

// Only reachable if the proxy did not run (it rewrites every store request).
export default function Root() {
  notFound()
}
