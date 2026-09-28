'use client'

import { UserRound } from '@commerce/ui/icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'
import { localize } from '@/lib/copy'
import type { Locale } from '@/lib/i18n'
import LanguageField from './language-field'

/** Settings › Account: preferences that belong to the signed-in member, starting with language. */
export default function AccountSettings() {
  // Hooks
  const copy = useCopy(accountContent)

  // Event handlers
  // The toast speaks the new language: the page itself switches when the refresh lands.
  const handleChanged = (next: Locale) =>
    toast.success(localize(accountContent, next).language.saved)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        icon={<UserRound aria-hidden="true" />}
      />
      <Card size="form">
        <CardHeader>
          <CardTitle>{copy.language.heading}</CardTitle>
          <CardDescription>{copy.language.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <LanguageField onChanged={handleChanged} />
          <p className="text-caption text-muted-foreground">{copy.language.partial}</p>
        </CardContent>
      </Card>
    </div>
  )
}
