import {
  Boxes,
  FileText,
  FolderOpen,
  ImageIcon,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Newspaper,
  Package,
  PanelBottom,
  PanelTop,
  Send,
  Video,
} from '@commerce/ui/icons'
import { SECTION_ICONS } from '@/lib/customize-puck'

type SectionIconProps = { type: string; className?: string }

const GLYPHS = {
  image: ImageIcon,
  megaphone: Megaphone,
  text: FileText,
  columns: LayoutGrid,
  quote: MessageSquare,
  list: FileText,
  shapes: Boxes,
  grid: LayoutGrid,
  package: Package,
  folder: FolderOpen,
  video: Video,
  news: Newspaper,
  send: Send,
} as const

/** The glyph a section shows in the tree and the add menu. */
export default function SectionIcon({ type, className }: SectionIconProps) {
  // Render logic
  if (type === 'Header') return <PanelTop aria-hidden className={className} />
  if (type === 'Footer') return <PanelBottom aria-hidden className={className} />
  const key = (SECTION_ICONS[type] ?? 'text') as keyof typeof GLYPHS
  const Glyph = GLYPHS[key] ?? FileText
  return <Glyph aria-hidden className={className} />
}
