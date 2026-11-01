import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Online store' }

export default function Page() {
  redirect('/online-store/themes')
}
