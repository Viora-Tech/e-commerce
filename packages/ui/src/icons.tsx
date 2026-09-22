/**
 * Every icon the admin and shared components use, as Hugeicons stroke glyphs.
 * Named exports keep the identifiers call sites already use; `icons` groups
 * them by meaning for new code. Add here, never import a glyph pack directly.
 */
import {
  Add01Icon,
  Alert02Icon,
  AlertCircleIcon,
  AlertDiamondIcon,
  Analytics01Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  ArrowDown02Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  ArrowUp01Icon,
  ArrowUp02Icon,
  ArrowUpDownIcon,
  BarChartIcon,
  BoxesIcon,
  Cancel01Icon,
  CancelCircleIcon,
  ChartUpIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  CreditCardIcon,
  DashboardSquare01Icon,
  Delete02Icon,
  DeliveryDelay02Icon,
  DeliveryTruck01Icon,
  Download04Icon,
  Edit02Icon,
  File01Icon,
  FileEditIcon,
  FilterHorizontalIcon,
  Folder01Icon,
  GiftIcon,
  GlobeIcon,
  Home01Icon,
  Image01Icon,
  Image02Icon,
  ImageAdd01Icon,
  InboxIcon,
  InformationCircleIcon,
  Layers01Icon,
  LeftToRightListBulletIcon,
  LinkSquare01Icon,
  Loading03Icon,
  Logout01Icon,
  Megaphone01Icon,
  Message01Icon,
  Moon02Icon,
  MoreHorizontalIcon as MoreHorizontalGlyph,
  MoreVerticalIcon as MoreVerticalGlyph,
  News01Icon,
  PackageDeliveredIcon,
  PackageOpenIcon,
  PackageRemoveIcon,
  PaintBoardIcon,
  PrinterIcon,
  PuzzleIcon,
  Radio02Icon,
  RefreshIcon,
  RotateLeft01Icon,
  Search01Icon,
  SearchRemoveIcon,
  Sent02Icon,
  Settings01Icon,
  ShapesIcon,
  ShoppingCart01Icon,
  SourceCodeIcon,
  Store01Icon,
  Sun02Icon,
  Tick02Icon,
  Ticket01Icon,
  UnfoldMoreIcon,
  Upload04Icon,
  User03Icon,
  UserMultipleIcon,
  UserSettings01Icon,
  Video01Icon,
  ViewOffIcon,
  WorkflowIcon,
} from '@hugeicons/core-free-icons'
import { defineIcon, definePath, type IconComponent } from './lib/icon'

export type { IconComponent, IconProps } from './lib/icon'
/** Legacy alias for call sites typed against Lucide. */
export type LucideIcon = IconComponent

/* Navigation */
export const Home = defineIcon(Home01Icon, 'Home')
export const ShoppingBag = defineIcon(ShoppingCart01Icon, 'ShoppingBag') // kit nav: cart
export const ShoppingCart = defineIcon(ShoppingCart01Icon, 'ShoppingCart')
export const Package = defineIcon(PackageOpenIcon, 'Package') // kit nav: product list box
export const Users = defineIcon(UserMultipleIcon, 'Users')
export const FolderOpen = defineIcon(Image02Icon, 'FolderOpen') // kit nav: product media
export const BarChart3 = defineIcon(Analytics01Icon, 'BarChart3')
export const Megaphone = defineIcon(Megaphone01Icon, 'Megaphone')
export const BadgePercent = defineIcon(Ticket01Icon, 'BadgePercent') // kit nav: coupon code
export const Store = defineIcon(Store01Icon, 'Store')
export const Blocks = defineIcon(ShapesIcon, 'Blocks') // kit nav: categories glyph
export const Puzzle = defineIcon(PuzzleIcon, 'Puzzle')
export const Settings = defineIcon(Settings01Icon, 'Settings') // kit nav: control authority
export const LayoutGrid = defineIcon(DashboardSquare01Icon, 'LayoutGrid')
export const Boxes = defineIcon(BoxesIcon, 'Boxes')
export const Gift = defineIcon(GiftIcon, 'Gift')
export const Globe = defineIcon(GlobeIcon, 'Globe')
export const Newspaper = defineIcon(News01Icon, 'Newspaper')
export const FileText = defineIcon(File01Icon, 'FileText')
export const FileEdit = defineIcon(FileEditIcon, 'FileEdit')
export const FileBarChart = defineIcon(BarChartIcon, 'FileBarChart')
export const ClipboardList = defineIcon(LeftToRightListBulletIcon, 'ClipboardList')
export const ListTree = defineIcon(Layers01Icon, 'ListTree')
export const Braces = defineIcon(SourceCodeIcon, 'Braces')
export const Workflow = defineIcon(WorkflowIcon, 'Workflow')
export const Radio = defineIcon(Radio02Icon, 'Radio')
export const Palette = defineIcon(PaintBoardIcon, 'Palette')
export const Images = defineIcon(Folder01Icon, 'Images')
export const UserCog = defineIcon(UserSettings01Icon, 'UserCog')
export const UserRound = defineIcon(User03Icon, 'UserRound')
export const CreditCard = defineIcon(CreditCardIcon, 'CreditCard')
export const Inbox = defineIcon(InboxIcon, 'Inbox')
export const MessageSquare = defineIcon(Message01Icon, 'MessageSquare')
export const Send = defineIcon(Sent02Icon, 'Send')
export const TrendingUp = defineIcon(ChartUpIcon, 'TrendingUp')

/* Chrome */
export const Search = defineIcon(Search01Icon, 'Search')
export const SearchIcon = Search
export const SearchX = defineIcon(SearchRemoveIcon, 'SearchX')
/* Kit 5:1357 "Bell outline": outline bell with a dot for unread. */
export const Bell = definePath(
  ['M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z', 'M10 21a2 2 0 0 0 4 0'],
  'Bell',
)
export const BellDot = definePath(
  ['M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17z', 'M10 21a2 2 0 0 0 4 0'],
  'BellDot',
  { fill: 'M17 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z' },
)
export const Sun = defineIcon(Sun02Icon, 'Sun')
export const SunIcon = Sun
export const Moon = defineIcon(Moon02Icon, 'Moon')
export const MoonIcon = Moon
export const LogOut = defineIcon(Logout01Icon, 'LogOut') // kit user card
/* Kit 5:1384 "arrow-menu-close": a bar on the right with a chevron pointing at it. Mirror with `-scale-x-100` when collapsed. */
export const PanelLeftClose = definePath(
  ['M20 5v14', 'M13 8l-4 4 4 4', 'M9 12h7'],
  'PanelLeftClose',
)
export const PanelLeftIcon = PanelLeftClose
export const ExternalLink = defineIcon(LinkSquare01Icon, 'ExternalLink') // kit Your Shop

/* Arrows and chevrons */
export const ChevronDown = defineIcon(ArrowDown01Icon, 'ChevronDown')
export const ChevronDownIcon = ChevronDown
export const ChevronUpIcon = defineIcon(ArrowUp01Icon, 'ChevronUpIcon')
export const ChevronLeftIcon = defineIcon(ArrowLeft02Icon, 'ChevronLeftIcon')
export const ChevronRightIcon = defineIcon(ArrowRight02Icon, 'ChevronRightIcon')
export const ChevronsUpDown = defineIcon(UnfoldMoreIcon, 'ChevronsUpDown')
export const ArrowUp = defineIcon(ArrowUp02Icon, 'ArrowUp')
export const ArrowDown = defineIcon(ArrowDown02Icon, 'ArrowDown')
export const ArrowLeft = defineIcon(ArrowLeft02Icon, 'ArrowLeft')
export const ArrowRight = defineIcon(ArrowRight02Icon, 'ArrowRight')
export const ArrowUpDown = defineIcon(ArrowUpDownIcon, 'ArrowUpDown')
export const ArrowLeftRight = defineIcon(ArrowDataTransferHorizontalIcon, 'ArrowLeftRight')

/* Actions */
export const Plus = defineIcon(Add01Icon, 'Plus')
export const SquarePlus = Plus
export const MoreHorizontal = defineIcon(MoreHorizontalGlyph, 'MoreHorizontal')
export const MoreHorizontalIcon = MoreHorizontal
export const MoreVertical = defineIcon(MoreVerticalGlyph, 'MoreVertical')
export const Filter = defineIcon(FilterHorizontalIcon, 'Filter')
export const SlidersHorizontal = Filter
export const Pencil = defineIcon(Edit02Icon, 'Pencil')
export const Trash2 = defineIcon(Delete02Icon, 'Trash2')
export const ImagePlus = defineIcon(ImageAdd01Icon, 'ImagePlus')
export const ImageIcon = defineIcon(Image01Icon, 'ImageIcon')
export const Video = defineIcon(Video01Icon, 'Video')
export const Upload = defineIcon(Upload04Icon, 'Upload')
export const Download = defineIcon(Download04Icon, 'Download')
export const RefreshCw = defineIcon(RefreshIcon, 'RefreshCw')
export const Save = defineIcon(Download04Icon, 'Save') // kit "save-01" on Save to draft
export const RotateCcw = defineIcon(RotateLeft01Icon, 'RotateCcw')
export const Printer = defineIcon(PrinterIcon, 'Printer')
export const Copy = defineIcon(Copy01Icon, 'Copy')
export const EyeOff = defineIcon(ViewOffIcon, 'EyeOff')
export const X = defineIcon(Cancel01Icon, 'X')
export const XIcon = X
export const CheckIcon = defineIcon(Tick02Icon, 'CheckIcon')
export const Loader2Icon = defineIcon(Loading03Icon, 'Loader2Icon')

/* Status */
export const CircleCheck = defineIcon(CheckmarkCircle02Icon, 'CircleCheck')
export const CircleCheckIcon = CircleCheck
export const CircleAlert = defineIcon(AlertCircleIcon, 'CircleAlert')
export const InfoIcon = defineIcon(InformationCircleIcon, 'InfoIcon')
export const TriangleAlert = defineIcon(Alert02Icon, 'TriangleAlert')
export const TriangleAlertIcon = defineIcon(AlertDiamondIcon, 'TriangleAlertIcon')
export const OctagonXIcon = defineIcon(CancelCircleIcon, 'OctagonXIcon')
export const Truck = defineIcon(DeliveryTruck01Icon, 'Truck')
export const PackageCheck = defineIcon(PackageDeliveredIcon, 'PackageCheck')
export const PackageOpen = defineIcon(PackageOpenIcon, 'PackageOpen')
export const PackageX = defineIcon(PackageRemoveIcon, 'PackageX')
export const Clock = defineIcon(Clock01Icon, 'Clock')
export const DeliveryDelay = defineIcon(DeliveryDelay02Icon, 'DeliveryDelay') // kit status: Pending
export const CancelCircle = defineIcon(CancelCircleIcon, 'CancelCircle') // kit status: Cancelled

/** Semantic map for new code. */
export const icons = {
  home: Home,
  orders: ShoppingBag,
  products: Package,
  customers: Users,
  content: FolderOpen,
  analytics: BarChart3,
  marketing: Megaphone,
  discounts: BadgePercent,
  store: Store,
  apps: Puzzle,
  settings: Settings,
  search: Search,
  bell: Bell,
  sun: Sun,
  moon: Moon,
  logout: LogOut,
  chevronDown: ChevronDown,
  chevronUp: ChevronUpIcon,
  chevronLeft: ChevronLeftIcon,
  chevronRight: ChevronRightIcon,
  plus: Plus,
  kebab: MoreHorizontal,
  kebabVertical: MoreVertical,
  filter: Filter,
  sort: ArrowUpDown,
  export: Download,
  import: Upload,
  truck: Truck,
  delivered: PackageCheck,
  pending: Clock,
  cancelled: PackageX,
  edit: Pencil,
  trash: Trash2,
  upload: Upload,
  image: ImageIcon,
  video: Video,
  check: CheckIcon,
  close: X,
  externalLink: ExternalLink,
  info: InfoIcon,
  warning: TriangleAlert,
  refresh: RefreshCw,
  copy: Copy,
  print: Printer,
  eye: EyeOff,
  spinner: Loader2Icon,
} as const
