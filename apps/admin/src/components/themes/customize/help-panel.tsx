'use client'

import { CheckIcon, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { modKey } from '@/lib/assistant-events'
import { EDITOR_HELP_URL } from './customize-rail'

type KeyName = keyof (typeof customizeContent)['help']['keys']

/** The editor's real shortcuts (`customize-hotkeys.tsx`, Puck's undo/redo, full view), each as
 * the keys to press; `mod` is ⌘ on a Mac and Ctrl elsewhere. */
const SHORTCUTS: { name: KeyName; keys: (mod: string) => string[] }[] = [
  { name: 'undo', keys: (mod) => [mod, 'Z'] },
  { name: 'redo', keys: (mod) => [mod, '⇧', 'Z'] },
  { name: 'duplicate', keys: (mod) => [mod, 'D'] },
  { name: 'copy', keys: (mod) => [mod, 'C'] },
  { name: 'paste', keys: (mod) => [mod, 'V'] },
  { name: 'move', keys: () => ['Alt', '↑ ↓'] },
  { name: 'remove', keys: () => ['Delete'] },
  { name: 'deselect', keys: () => ['Esc'] },
  { name: 'fullView', keys: () => ['\\'] },
]

const LABEL =
  'text-[0.625rem] leading-[1.0625rem] font-medium tracking-[0.05em] text-muted-foreground uppercase'

/**
 * The rail's Help tab (Figma 381:8563): the keyboard shortcuts with their keys, the editor guide
 * (a new tab), and what's new in the editor.
 */
export default function HelpPanel() {
  // Hooks
  const copy = useCopy(customizeContent.help)

  // Render logic
  const mod = modKey()

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <p className={LABEL}>{copy.shortcuts}</p>
      <dl className="-mt-1 flex flex-col gap-2.5">
        {SHORTCUTS.map(({ name, keys }) => (
          <div key={name} className="flex items-center gap-2">
            <dt className="min-w-0 flex-1 truncate text-[0.8125rem] leading-[1.1875rem] text-foreground">
              {copy.keys[name]}
            </dt>
            <dd className="flex shrink-0 items-center gap-1">
              {keys(mod).map((key) => (
                <kbd
                  key={key}
                  className="min-w-5 rounded-md bg-muted px-1.5 py-0.5 text-center font-sans text-xs leading-4 text-muted-foreground"
                >
                  {key}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
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
