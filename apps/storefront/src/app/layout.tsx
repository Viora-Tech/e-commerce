import type { ReactNode } from 'react'
import './globals.css'

// Root layout is shared by the store segment and the bare 404 root.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
