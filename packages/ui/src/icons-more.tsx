/**
 * More icons, kept beside `./icons.tsx` (which is at its size cap) and re-exported from it, so
 * call sites still import everything from `@commerce/ui/icons`.
 */
import {
  CornersIn,
  CornersOut,
  ListBullets,
  ListNumbers,
  Minus,
  Cursor as PhCursor,
  Question,
  Quotes,
  SidebarSimple,
  Stack,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from '@phosphor-icons/react/ssr'
import { defineIcon } from './lib/icon'

/** Layers of a page (the theme editor's Sections tab). */
export const Layers = defineIcon(Stack, 'Layers', 'duotone')
/** Help, a question mark in a circle. */
export const HelpCircle = defineIcon(Question, 'HelpCircle', 'duotone')

/** Rich-text formatting controls (the theme editor's text menus). */
export const TextBold = defineIcon(TextB, 'TextBold')
export const TextItalicIcon = defineIcon(TextItalic, 'TextItalic')
export const TextUnderlineIcon = defineIcon(TextUnderline, 'TextUnderline')
export const TextStrikeIcon = defineIcon(TextStrikethrough, 'TextStrike')
export const ListBulleted = defineIcon(ListBullets, 'ListBulleted')
export const ListNumbered = defineIcon(ListNumbers, 'ListNumbered')
export const QuoteIcon = defineIcon(Quotes, 'QuoteIcon')
export const RuleIcon = defineIcon(Minus, 'RuleIcon')

/** The theme editor's full view: hide the panels to see the page alone, and back. */
export const FullViewIcon = defineIcon(CornersOut, 'FullView')
export const ExitFullViewIcon = defineIcon(CornersIn, 'ExitFullView')
/** Show or hide a side panel. */
export const SidebarToggleIcon = defineIcon(SidebarSimple, 'SidebarToggle')
/** A pointer: "click it". */
export const Cursor = defineIcon(PhCursor, 'Cursor')
