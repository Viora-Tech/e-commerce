/**
 * The theme editor's section glyphs, kept beside `./icons.tsx` (which is at its size cap) and
 * re-exported from it, so call sites still import them from `@commerce/ui/icons`.
 */
import {
  AlignBottomIcon as EdAlignBottom,
  AlignTopIcon as EdAlignTop,
  ArrowDataTransferHorizontalIcon as EdArrowsLeftRight,
  ArrowUpDownIcon as EdArrowsVertical,
  ShoppingBasket01Icon as EdBasket,
  SquareIcon as EdBoundingBox,
  ChartLineData02Icon as EdChartLineUp,
  SourceCodeIcon as EdCode,
  LayoutTwoColumnIcon as EdColumns,
  Cursor01Icon as EdCursorClick,
  Mail01Icon as EdEnvelope,
  File02Icon as EdFileText,
  Film01Icon as EdFilmStrip,
  Folder01Icon as EdFolder,
  Image01Icon as EdImage,
  Image02Icon as EdImages,
  LeftToRightListDashIcon as EdListDashes,
  Search01Icon as EdMagnifyingGlass,
  Megaphone01Icon as EdMegaphone,
  MinusSignIcon as EdMinus,
  News01Icon as EdNewspaper,
  PackageIcon as EdPackage,
  QuoteDownIcon as EdQuotes,
  LayoutTwoRowIcon as EdRows,
  ShapeCollectionIcon as EdShapes,
  Presentation01Icon as EdSlideshow,
  SparklesIcon as EdSparkle,
  LayoutTwoColumnIcon as EdSplit,
  DashboardSquare02Icon as EdSquaresFour,
  SparklesIcon as EdStarFour,
  BrowserIcon as EdTabs,
  Tag01Icon as EdTag,
  TextAlignLeftIcon as EdTextAlignLeft,
  Heading01Icon as EdTextH,
  AlertCircleIcon as EdWarningCircle,
} from '@hugeicons/core-free-icons'
import { defineIcon } from './lib/icon'

/*
 * Theme editor section glyphs: one family, Phosphor regular, drawn at 16px in the
 * sidebar and 14px inline. Keyed by what the section is, not by its type, so new
 * sections pick a glyph from here (see `SECTION_GLYPH` in the admin's
 * lib/customize-section-kinds.ts). Never mix weights or filled glyphs in the editor.
 */
export const editorGlyphs = {
  header: defineIcon(EdAlignTop, 'GlyphHeader'),
  footer: defineIcon(EdAlignBottom, 'GlyphFooter'),
  image: defineIcon(EdImage, 'GlyphImage'),
  megaphone: defineIcon(EdMegaphone, 'GlyphMegaphone'),
  text: defineIcon(EdTextAlignLeft, 'GlyphText'),
  page: defineIcon(EdFileText, 'GlyphPage'),
  columns: defineIcon(EdColumns, 'GlyphColumns'),
  quote: defineIcon(EdQuotes, 'GlyphQuote'),
  list: defineIcon(EdListDashes, 'GlyphList'),
  shapes: defineIcon(EdShapes, 'GlyphShapes'),
  grid: defineIcon(EdSquaresFour, 'GlyphGrid'),
  package: defineIcon(EdPackage, 'GlyphPackage'),
  folder: defineIcon(EdFolder, 'GlyphFolder'),
  video: defineIcon(EdFilmStrip, 'GlyphVideo'),
  news: defineIcon(EdNewspaper, 'GlyphNews'),
  send: defineIcon(EdEnvelope, 'GlyphSend'),
  spotlight: defineIcon(EdSparkle, 'GlyphSpotlight'),
  split: defineIcon(EdSplit, 'GlyphSplit'),
  marquee: defineIcon(EdArrowsLeftRight, 'GlyphMarquee'),
  stats: defineIcon(EdChartLineUp, 'GlyphStats'),
  gallery: defineIcon(EdImages, 'GlyphGallery'),
  cart: defineIcon(EdBasket, 'GlyphCart'),
  search: defineIcon(EdMagnifyingGlass, 'GlyphSearch'),
  notFound: defineIcon(EdWarningCircle, 'GlyphNotFound'),
  // Build-your-own blocks: containers and elements.
  group: defineIcon(EdBoundingBox, 'GlyphGroup'),
  tabs: defineIcon(EdTabs, 'GlyphTabs'),
  accordion: defineIcon(EdRows, 'GlyphAccordion'),
  carousel: defineIcon(EdSlideshow, 'GlyphCarousel'),
  heading: defineIcon(EdTextH, 'GlyphHeading'),
  button: defineIcon(EdCursorClick, 'GlyphButton'),
  icon: defineIcon(EdStarFour, 'GlyphIcon'),
  spacer: defineIcon(EdArrowsVertical, 'GlyphSpacer'),
  divider: defineIcon(EdMinus, 'GlyphDivider'),
  badge: defineIcon(EdTag, 'GlyphBadge'),
  code: defineIcon(EdCode, 'GlyphCode'),
} as const
export type EditorGlyph = keyof typeof editorGlyphs
