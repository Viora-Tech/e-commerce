'use client'

import { SOCIAL_PLATFORMS, type SocialPlatform, type Theme } from '@commerce/core/theme'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { themesContent as copy } from '@/data/themes'

type SocialSettingsProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v)

/**
 * Theme settings → Social media: one link per network. A blank field drops the network; a
 * half-typed link is kept here until it is a full URL, so the saved theme stays valid.
 */
export default function SocialSettings({ theme, onChange }: SocialSettingsProps) {
  // Hooks
  const [drafts, setDrafts] = useState<Partial<Record<SocialPlatform, string>>>({})

  // Event handlers
  const handleChange = (platform: SocialPlatform, value: string) => {
    setDrafts((d) => ({ ...d, [platform]: value }))
    const url = value.trim()
    if (url && !isUrl(url)) return
    const rest = theme.social.links.filter((l) => l.platform !== platform)
    const links = url ? [...rest, { platform, url }] : rest
    // Keep the networks in the panel's order.
    links.sort(
      (a, b) => SOCIAL_PLATFORMS.indexOf(a.platform) - SOCIAL_PLATFORMS.indexOf(b.platform),
    )
    onChange({ ...theme, social: { links } })
  }

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      {SOCIAL_PLATFORMS.map((platform) => {
        const saved = theme.social.links.find((l) => l.platform === platform)?.url ?? ''
        const value = drafts[platform] ?? saved
        const invalid = value.trim() !== '' && !isUrl(value.trim())
        const id = `social-${platform}`
        return (
          <div key={platform} className="flex flex-col gap-1">
            <label htmlFor={id} className="text-xs font-medium text-foreground">
              {copy.social.platforms[platform]}
            </label>
            <Input
              id={id}
              type="url"
              inputMode="url"
              value={value}
              placeholder={copy.social.placeholder}
              aria-invalid={invalid || undefined}
              onChange={(e) => handleChange(platform, e.target.value)}
              className="h-8"
            />
            {invalid ? <p className="text-xs text-destructive">{copy.social.invalid}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
