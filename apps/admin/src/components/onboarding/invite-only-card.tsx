import DataCard from '@/components/layout/data-card'
import { onboardingContent } from '@/data/onboarding'
import { getCopy } from '@/lib/copy-server'
import WaitlistForm from './waitlist-form'

type InviteOnlyCardProps = { defaultEmail: string }

/** Shown instead of the wizard when MERCHANT_SIGNUP_MODE=invite and this email has no live invite. */
export default async function InviteOnlyCard({ defaultEmail }: InviteOnlyCardProps) {
  // Render logic
  const copy = await getCopy(onboardingContent)

  return (
    <DataCard
      title={copy.inviteOnly.heading}
      className="h-auto w-full max-w-md"
      bodyClassName="flex flex-col gap-5"
    >
      <p className="text-body text-muted-foreground">{copy.inviteOnly.body}</p>
      <WaitlistForm defaultEmail={defaultEmail} />
    </DataCard>
  )
}
