import {
  ArrowLeftRight,
  Boxes,
  Columns,
  FileText,
  FolderOpen,
  ImageIcon,
  Images,
  LayoutGrid,
  Megaphone,
  MessageSquare,
  Monitor,
  Newspaper,
  Package,
  PanelBottom,
  PanelTop,
  Send,
  TrendingUp,
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
  spotlight: Monitor,
  split: Columns,
  marquee: ArrowLeftRight,
  stats: TrendingUp,
  gallery: Images,
} as const

/** The glyph a section shows in the tree and the add menu. */
export default function SectionIcon({ type, className }: SectionIconProps) {
  // Render logic
  if (type === 'Header') return <PanelTop aria-hidden weight="light" className={className} />
  if (type === 'Footer') return <PanelBottom aria-hidden weight="light" className={className} />
  const key = (SECTION_ICONS[type] ?? 'text') as keyof typeof GLYPHS
  const Glyph = GLYPHS[key] ?? FileText
  return <Glyph aria-hidden weight="light" className={className} />
}
