import { CheckIcon as Check } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import SettingsSection from '@/components/affiliate-portal/settings-section'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { requireAffiliate } from '@/lib/affiliate-portal'

type NotificationsPageProps = { params: Promise<{ storeId: string }> }

const copy = affiliatePortalContent.settings.notifications

export const metadata: Metadata = { title: affiliatePortalContent.settings.tabs.notifications }

/**
 * Settings › Notifications: what the store sends them. Read only: the Affiliates app has no
 * per-affiliate notification choices to store (UpPromote's switches have nothing to save to).
 */
export default async function NotificationsPage({ params }: NotificationsPageProps) {
  // Hooks
  const { storeId } = await params
  await requireAffiliate(storeId)

  // Render logic
  return (
    <SettingsSection title={copy.title} description={copy.help}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {copy.items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{copy.fixed}</p>
      </div>
    </SettingsSection>
  )
}
