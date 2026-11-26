import type { Metadata } from 'next'
import CodeRequestCard from '@/components/affiliate-portal/code-request-card'
import ProfileForm from '@/components/affiliate-portal/profile-form'
import SettingsSection from '@/components/affiliate-portal/settings-section'
import { affiliateContent } from '@/data/affiliate'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { requireAffiliate } from '@/lib/affiliate-portal'

type ProfilePageProps = { params: Promise<{ storeId: string }> }

const copy = affiliatePortalContent.settings.profile

export const metadata: Metadata = { title: affiliatePortalContent.settings.tabs.profile }

/** Settings › Profile: name and main profile link, the account's email and phone, their code. */
export default async function ProfilePage({ params }: ProfilePageProps) {
  // Hooks
  const { storeId } = await params
  const { me, affiliate } = await requireAffiliate(storeId)

  // Render logic
  const request = affiliate.codeRequest
    ? { code: affiliate.codeRequest.code, status: affiliate.codeRequest.status }
    : null
  return (
    <>
      <SettingsSection title={copy.title} description={copy.help}>
        <ProfileForm
          name={affiliate.name}
          social={affiliate.social}
          email={me.email ?? affiliate.email}
          phone={me.phone ?? null}
        />
      </SettingsSection>
      <SettingsSection title={copy.code} description={affiliateContent.dashboard.vanity.help}>
        <CodeRequestCard code={affiliate.code} request={request} />
      </SettingsSection>
    </>
  )
}
