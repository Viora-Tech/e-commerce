import { redirect } from 'next/navigation'
import { portalHref, requireAffiliate } from '@/lib/affiliate-portal'

type SettingsPageProps = { params: Promise<{ storeId: string }> }

/** Settings opens on Profile. */
export default async function SettingsPage({ params }: SettingsPageProps) {
  // Hooks
  const { storeId } = await params
  const { base } = await requireAffiliate(storeId)

  // Render logic
  return redirect(portalHref(base, '/settings/profile'))
}
