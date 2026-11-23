import {
  type CellBlock,
  type DesignBlock,
  type EmailTemplateDesign,
  isSafeImage,
  isSafeLink,
  unknownVariables,
} from '@commerce/notifications/design'

/**
 * What the editor checks before Save (the server checks again): words that cannot fill in,
 * links that are not https, http or mailto, and blocks missing what they need to show.
 */

/** Every text field of a block that may hold variables, nested cells included. */
function textsOf(block: DesignBlock | CellBlock): string[] {
  switch (block.type) {
    case 'intro':
      return [block.eyebrow ?? '', block.heading ?? '', block.lead ?? '']
    case 'slot':
      return Object.values(block.edit?.texts ?? {})
    case 'heading':
    case 'text':
      return [block.text]
    case 'image':
      return [block.alt, block.href ?? '']
    case 'button':
      return [block.label, block.url]
    case 'divider':
      return [block.label]
    case 'help':
      return [block.title ?? '', block.body ?? '']
    case 'footer':
      return [block.note ?? '', ...(block.links ?? []).flatMap((l) => [l.label, l.url])]
    case 'hero':
      return [
        block.alt,
        block.heading,
        block.text,
        block.buttonLabel,
        block.buttonUrl,
        block.href ?? '',
      ]
    case 'products':
      return [block.title, block.buttonLabel]
    case 'coupon':
      return [block.code, block.label, block.note, block.value, block.valueNote]
    case 'video':
      return [block.alt, block.label, block.url]
    case 'html':
      return [block.html]
    case 'columns':
      return block.cells.flat().flatMap(textsOf)
    default:
      return []
  }
}

/** Links a block carries that a shopper may click. */
function linksOf(block: DesignBlock | CellBlock): string[] {
  switch (block.type) {
    case 'button':
      return [block.url]
    case 'image':
      return block.href ? [block.href] : []
    case 'hero':
      return [...(block.href ? [block.href] : []), ...(block.buttonLabel ? [block.buttonUrl] : [])]
    case 'video':
      return [block.url]
    case 'footer':
      return (block.links ?? []).map((l) => l.url)
    case 'columns':
      return block.cells.flat().flatMap(linksOf)
    default:
      return []
  }
}

function isEmpty(block: DesignBlock | CellBlock): boolean {
  switch (block.type) {
    case 'button':
      return !block.label.trim()
    case 'image':
    case 'hero':
      return !block.src
    case 'video':
      return !block.src || !block.url.trim()
    case 'coupon':
      return !block.code.trim()
    case 'footer':
      return (block.links ?? []).some((l) => !l.label.trim())
    case 'columns':
      return block.cells.flat().some(isEmpty)
    default:
      return false
  }
}

export type BlockProblem = { unknown: string[]; badLink: boolean; empty: boolean }

/** What is wrong with a block before it can be saved; null when it is fine. */
export function blockProblem(
  block: DesignBlock | CellBlock,
  variables: readonly string[],
): BlockProblem | null {
  const unknown = [...new Set(textsOf(block).flatMap((t) => unknownVariables(t, variables)))]
  const badLink =
    linksOf(block).some((l) => !isSafeLink(l)) ||
    ((block.type === 'image' || block.type === 'hero' || block.type === 'video') &&
      Boolean(block.src) &&
      !isSafeImage(block.src))
  const empty = isEmpty(block)
  return unknown.length > 0 || badLink || empty ? { unknown, badLink, empty } : null
}

export function subjectUnknown(design: EmailTemplateDesign, variables: readonly string[]) {
  return unknownVariables(design.subject ?? '', variables)
}
