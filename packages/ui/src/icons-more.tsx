/**
 * More icons, kept beside `./icons.tsx` (which is at its size cap) and re-exported from it, so
 * call sites still import everything from `@commerce/ui/icons`.
 */
import {
  CircleIcon,
  ArrowShrink02Icon as CornersIn,
  ArrowExpand01Icon as CornersOut,
  Flag02Icon,
  HighlighterIcon,
  KeyboardIcon as Keyboard,
  LeftToRightListBulletIcon as ListBullets,
  LeftToRightListNumberIcon as ListNumbers,
  MinusSignIcon as Minus,
  Cursor01Icon as PhCursor,
  HelpCircleIcon as Question,
  QuoteDownIcon as Quotes,
  SidebarLeftIcon as SidebarSimple,
  SparklesIcon,
  Layers01Icon as Stack,
  TextBoldIcon as TextB,
  TextItalicIcon as TextItalic,
  TextStrikethroughIcon as TextStrikethrough,
  TextUnderlineIcon as TextUnderline,
} from '@hugeicons/core-free-icons'
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
/** Keyboard shortcuts. */
export const KeyboardIcon = defineIcon(Keyboard, 'KeyboardIcon')

/* Glyphs a few call sites use under their plain names. */
export const Circle = defineIcon(CircleIcon, 'Circle')
export const Flag = defineIcon(Flag02Icon, 'Flag')
export const Highlighter = defineIcon(HighlighterIcon, 'Highlighter')
export const Sparkle = defineIcon(SparklesIcon, 'Sparkle')
