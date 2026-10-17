'use client'

import { ArrowRight, Inbox } from '@commerce/ui/icons'
import { useState } from 'react'
import { siteContent } from '@/data/site'
import { waitlistContent as copy } from '@/data/waitlist'
import { ctaClass } from '@/lib/cta'
import { useWaitlist } from './waitlist-context'

export default function HeroEmailCapture() {
  // Hooks
  const { openWaitlist } = useWaitlist()
  const [email, setEmail] = useState('')

  // Event handlers
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    openWaitlist(email.trim())
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-panel flex w-full max-w-120 items-center gap-2 rounded-full p-1 pl-4"
    >
      <Inbox aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <label htmlFor="hero-email" className="sr-only">
        {copy.hero.emailLabel}
      </label>
      <input
        id="hero-email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={copy.hero.placeholder}
        className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button type="submit" className={ctaClass('md')}>
        <span className="max-sm:hidden">{siteContent.joinWaitlist}</span>
        <span className="sm:hidden">{copy.hero.joinShort}</span>
        <ArrowRight aria-hidden />
      </button>
    </form>
  )
}
