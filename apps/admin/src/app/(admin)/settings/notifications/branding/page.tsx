import type { Metadata } from 'next'
import EmailBrandingPage from '@/components/notifications/branding/email-branding-page'
import { emailBrandingContent } from '@/data/email-branding'

export const metadata: Metadata = { title: emailBrandingContent.title }

/** Settings → Notifications → Email branding: logo and colours for every email. */
export default function EmailBrandingRoute() {
  return <EmailBrandingPage />
}
