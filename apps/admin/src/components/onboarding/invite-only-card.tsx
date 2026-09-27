import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { onboardingContent as copy } from '@/data/onboarding'
import WaitlistForm from './waitlist-form'

type InviteOnlyCardProps = { defaultEmail: string }

/** Shown instead of the wizard when MERCHANT_SIGNUP_MODE=invite and this email has no live invite. */
export default function InviteOnlyCard({ defaultEmail }: InviteOnlyCardProps) {
  return (
    <Card size="form" className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-page-title text-ink-strong">{copy.inviteOnly.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-body text-muted-foreground">{copy.inviteOnly.body}</p>
        <WaitlistForm defaultEmail={defaultEmail} />
      </CardContent>
    </Card>
  )
}
