'use client'

import { Download, Printer_ as Printer } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { legalContent as copy } from '@/data/legal'

type LegalActionsProps = { readMinutes: number }

/** Meta row: last updated, read time, English / हिन्दी switch, and the print actions. */
export default function LegalActions({ readMinutes }: LegalActionsProps) {
  // Hooks
  const [language, setLanguage] = useState<'en' | 'hi'>('en')

  // Event handlers
  const handlePrint = () => window.print()

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
          {copy.lastUpdated}
        </span>
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
          {readMinutes} {copy.minRead}
        </span>
        <fieldset
          aria-label={copy.languageLabel}
          className="m-0 inline-flex min-w-0 rounded-full border border-border p-0.5"
        >
          {(['en', 'hi'] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={language === code}
              onClick={() => setLanguage(code)}
              className={cn(
                'h-7 rounded-full px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                language === code ? 'bg-foreground text-background' : 'text-muted-foreground',
              )}
            >
              {code === 'en' ? copy.english : copy.hindi}
            </button>
          ))}
        </fieldset>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Download aria-hidden />
          {copy.downloadPdf}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer aria-hidden />
          {copy.print}
        </Button>
      </div>
      {language === 'hi' ? (
        <p role="status" className="text-sm text-muted-foreground">
          {copy.hindiSoon}
        </p>
      ) : null}
    </div>
  )
}
