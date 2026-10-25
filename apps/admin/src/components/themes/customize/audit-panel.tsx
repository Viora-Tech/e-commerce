'use client'

import { ChevronRight, CircleCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useReducedMotion } from 'motion/react'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { type AuditIssue, type AuditKind, auditTemplate } from '@/lib/customize-audit'
import { scrollToSection } from '@/lib/customize-canvas-motion'
import { CHROME_FOCUS, CHROME_TRANSITION } from '@/lib/customize-chrome'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { sectionName } from '@/lib/customize-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { findBlock, locateBlock } from '@/lib/customize-slots'
import { useThemePreview } from '@/lib/customize-theme-context'
import SectionIcon from './section-icon'

type AuditPanelProps = {
  /** Opens Theme settings, where colour issues are fixed. */
  onOpenTheme: () => void
}

/**
 * The Audit tab beside Sections: what on this template a shopper would trip over (a picture
 * with no description, a button that goes nowhere, a section hidden on every screen, an empty
 * heading, colours that are hard to read), in plain words. Picking a row selects the block and
 * brings it into view; a colour row opens Theme settings.
 */
export default function AuditPanel({ onOpenTheme }: AuditPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.audit)
  const contrast = useCopy(themesContent.contrast)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const components = useCustomizePuck((s) => s.config.components)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const theme = useThemePreview()
  const reducedMotion = useReducedMotion()

  // Helpers
  const labelOf = (type: string) => components[type]?.label ?? type

  // Event handlers
  const handlePick = (issue: AuditIssue) => {
    if (!issue.blockId) {
      onOpenTheme()
      return
    }
    const located = locateBlock(data, issue.blockId)
    if (!located) return
    dispatch({ type: 'setUi', ui: { itemSelector: { index: located.index, zone: located.zone } } })
    scrollToSection(issue.blockId, reducedMotion === true)
  }

  // Render logic
  const issues = auditTemplate(
    data,
    (type) => components[type]?.defaultProps as Record<string, unknown> | undefined,
    theme,
  )

  // Early returns
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-success-soft text-success">
          <CircleCheck aria-hidden weight="regular" className="size-5" />
        </span>
        <p className="text-[0.8125rem] font-medium text-foreground">{copy.empty}</p>
        <p className="text-xs text-muted-foreground">{copy.emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-2 py-3">
      <p className="px-2 text-xs text-muted-foreground">
        {copy.count(issues.length)}. {copy.hint}
      </p>
      <ul className="flex flex-col gap-0.5">
        {issues.map((issue, i) => {
          const block = issue.blockId ? findBlock(data, issue.blockId) : null
          const name = block ? sectionName(block, labelOf(block.type)) : copy.theme
          const message = issue.contrast
            ? `${contrast.pairs[issue.contrast.pair]}. ${contrast.ratio(issue.contrast.mode, issue.contrast.ratio)}`
            : copy.issues[issue.kind as Exclude<AuditKind, 'contrast'>](issue.count)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: one block can have several kinds; the list is rebuilt on every edit.
            <li key={`${issue.blockId ?? 'theme'}-${issue.kind}-${i}`}>
              <button
                type="button"
                onClick={() => handlePick(issue)}
                className={cn(
                  'group flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted/60',
                  CHROME_TRANSITION,
                  CHROME_FOCUS,
                )}
              >
                {issue.contrast ? (
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-xs font-semibold"
                    style={{
                      color: issue.contrast.foreground,
                      backgroundColor: issue.contrast.background,
                    }}
                  >
                    {contrast.swatch}
                  </span>
                ) : (
                  <SectionIcon type={issue.type ?? ''} tile="sm" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[0.8125rem] leading-5 font-medium text-foreground">
                    {message}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {name} · {copy.fixes[issue.kind]}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
