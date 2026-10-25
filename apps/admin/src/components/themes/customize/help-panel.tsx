'use client'

import { CheckIcon, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { EDITOR_HELP_URL } from './customize-rail'
import ShortcutList from './shortcut-list'

const LABEL =
  'text-[0.625rem] leading-[1.0625rem] font-medium tracking-[0.05em] text-muted-foreground uppercase'

/**
 * The rail's Help tab (Figma 381:8563): the keyboard shortcuts with their keys (the same list as
 * the `?` dialog, `ShortcutList`), the editor guide (a new tab), and what's new in the editor.
 */
export default function HelpPanel() {
  // Hooks
  const copy = useCopy(customizeContent.help)

  // Render logic
  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <p className={LABEL}>{copy.shortcuts}</p>
      <div className="-mt-1">
        <ShortcutList />
      </div>
      <Button
        variant="outline"
        className="w-fit"
        nativeButton={false}
        render={<a href={EDITOR_HELP_URL} target="_blank" rel="noreferrer" />}
      >
        {copy.guide}
        <ExternalLink aria-hidden />
      </Button>
      <p className={LABEL}>{copy.whatsNew}</p>
      <ul className="-mt-1 flex flex-col gap-2.5">
        {copy.news.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[0.8125rem] leading-[1.1875rem] text-muted-foreground"
          >
            <CheckIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
