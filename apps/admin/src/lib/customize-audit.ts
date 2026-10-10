import type { TemplateSection, Theme } from '@commerce/core/theme'
import { type ContrastWarning, themeContrastWarnings } from '@commerce/core/theme'
import type { CustomizeDoc } from './customize-doc'
import { eachBlock } from './customize-slots'

/**
 * SOURCE OF TRUTH KEYWORDS: auditTemplate, AuditIssue, Customize audit tab
 * WHAT:  The checks behind Customize's Audit tab: things on the open template a shopper would
 *        trip over, each tied to the block to fix (or, for colours, to the theme).
 * WHY:   Merchants rarely notice a picture without a description, a button that goes nowhere
 *        or a section hidden on every screen. Pure, so it runs on every edit and is tested.
 * WHERE: `components/themes/customize/audit-panel.tsx` lists the issues.
 */

export type AuditKind = 'alt' | 'link' | 'hidden' | 'heading' | 'contrast'

export type AuditIssue = {
  kind: AuditKind
  /** The block to select; null for a theme-wide issue (colours). */
  blockId: string | null
  /** The block's type, for its name and icon. */
  type: string | null
  /** How many times the block has this issue (three pictures without a description). */
  count: number
  contrast?: ContrastWarning | undefined
}

type Value = unknown

const isBlock = (v: Value): v is TemplateSection =>
  Boolean(v) && typeof v === 'object' && typeof (v as TemplateSection).type === 'string'

/** Every plain object in a block's own props; nested blocks (slots) are audited on their own. */
function eachObject(value: Value, fn: (o: Record<string, Value>) => void): void {
  if (Array.isArray(value)) {
    for (const v of value) if (!isBlock(v)) eachObject(v, fn)
    return
  }
  if (!value || typeof value !== 'object') return
  const o = value as Record<string, Value>
  fn(o)
  for (const v of Object.values(o)) eachObject(v, fn)
}

const filled = (v: Value): boolean => typeof v === 'string' && v.trim() !== ''

/** A picture is set but nobody described it (`{ url, alt }`, the image field's shape). */
const missingAlt = (o: Record<string, Value>) =>
  'url' in o && 'alt' in o && filled(o.url) && !filled(o.alt)

/** A button or link with words but nowhere to go (`{ label, href }`, the link field's shape). */
const deadLink = (o: Record<string, Value>) =>
  'label' in o && 'href' in o && filled(o.label) && !filled(o.href)

function hiddenEverywhere(props: Record<string, Value>): boolean {
  const advanced = (props.settings as { advanced?: Record<string, Value> } | undefined)?.advanced
  if (advanced && advanced.showOnMobile === false && advanced.showOnDesktop === false) return true
  const visibility = (props.style as { visibility?: Record<string, Value> } | undefined)?.visibility
  return Boolean(
    visibility &&
      visibility.mobile === false &&
      visibility.tablet === false &&
      visibility.desktop === false,
  )
}

/**
 * A heading left empty: the Heading element with no words, or a section whose heading is blank
 * though it comes with one (so a section that starts without a heading is not flagged).
 */
function emptyHeading(
  block: TemplateSection,
  defaults: Record<string, Value> | undefined,
): boolean {
  const props = block.props as Record<string, Value>
  if (block.type === 'Heading') return typeof props.text === 'string' && props.text.trim() === ''
  return (
    filled(defaults?.heading) && typeof props.heading === 'string' && props.heading.trim() === ''
  )
}

/** The issues on one template, in page order, then the theme's colour pairs. */
export function auditTemplate(
  doc: CustomizeDoc,
  defaultsOf: (type: string) => Record<string, Value> | undefined,
  theme: Theme | null,
): AuditIssue[] {
  const issues: AuditIssue[] = []
  eachBlock(doc, (block) => {
    const props = (block.props ?? {}) as Record<string, Value>
    // A block hidden with the eye is the merchant's choice; it is not on the page to check.
    if (props._hidden === true) return false
    const id = String(props.id ?? '')
    let alts = 0
    let links = 0
    for (const [key, value] of Object.entries(props)) {
      if (key === 'id' || key === 'settings' || key === 'style') continue
      eachObject(value, (o) => {
        if (missingAlt(o)) alts += 1
        if (deadLink(o)) links += 1
      })
    }
    const add = (kind: AuditKind, count = 1) =>
      issues.push({ kind, blockId: id, type: block.type, count })
    if (hiddenEverywhere(props)) add('hidden')
    if (emptyHeading(block, defaultsOf(block.type))) add('heading')
    if (alts > 0) add('alt', alts)
    if (links > 0) add('link', links)
    return false
  })
  for (const warning of theme ? themeContrastWarnings(theme) : []) {
    issues.push({ kind: 'contrast', blockId: null, type: null, count: 1, contrast: warning })
  }
  return issues
}
