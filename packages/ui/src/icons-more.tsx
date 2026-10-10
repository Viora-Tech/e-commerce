/**
 * More icons, kept beside `./icons.tsx` (which is at its size cap) and re-exported from it, so
 * call sites still import everything from `@commerce/ui/icons`.
 */
import { Question, Stack } from '@phosphor-icons/react/ssr'
import { defineIcon } from './lib/icon'

/** Layers of a page (the theme editor's Sections tab). */
export const Layers = defineIcon(Stack, 'Layers', 'duotone')
/** Help, a question mark in a circle. */
export const HelpCircle = defineIcon(Question, 'HelpCircle', 'duotone')
