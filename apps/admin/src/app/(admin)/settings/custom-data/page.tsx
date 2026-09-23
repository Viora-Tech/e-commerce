import type { Metadata } from 'next'
import CustomDataSettings from '@/components/metaobjects/custom-data-settings'

export const metadata: Metadata = { title: 'Custom data' }

export default function Page() {
  return <CustomDataSettings />
}
