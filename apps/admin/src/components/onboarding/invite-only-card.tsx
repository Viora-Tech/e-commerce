import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { onboardingContent as copy } from '@/data/onboarding'

/** Shown instead of the wizard when MERCHANT_SIGNUP_MODE=invite and this email has no live invite. */
export default function InviteOnlyCard() {
  return (
    <Card size="form" className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-page-title text-ink-strong">{copy.inviteOnly.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-body text-muted-foreground">{copy.inviteOnly.body}</p>
      </CardContent>
    </Card>
  )
}
