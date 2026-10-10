/**
 * Every icon the admin and shared components use, as Phosphor glyphs.
 * Named exports keep the identifiers call sites already use; `icons` groups
 * them by meaning for new code. Add here, never import a glyph pack directly.
 */
import {
  Armchair,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowsLeftRight,
  ArrowUp,
  ArrowUUpLeft,
  ArrowUUpRight,
  Basket,
  BellSimple,
  BellSimpleRinging,
  BracketsCurly,
  Bug,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretUpDown,
  ChartBar,
  ChartLineUp,
  ChatCircleText,
  Check,
  CheckCircle,
  Circle,
  ClipboardText,
  Columns,
  Copy,
  CreditCard,
  Cube,
  Database,
  DeviceMobile,
  DeviceTablet,
  DotsSix,
  DotsThree,
  DotsThreeOutline,
  DotsThreeVertical,
  DownloadSimple,
  AlignBottom as EdAlignBottom,
  AlignTop as EdAlignTop,
  ArrowsLeftRight as EdArrowsLeftRight,
  ArrowsVertical as EdArrowsVertical,
  Basket as EdBasket,
  BoundingBox as EdBoundingBox,
  ChartLineUp as EdChartLineUp,
  Code as EdCode,
  Columns as EdColumns,
  CursorClick as EdCursorClick,
  EnvelopeSimple as EdEnvelope,
  FileText as EdFileText,
  FilmStrip as EdFilmStrip,
  FolderSimple as EdFolder,
  Image as EdImage,
  Images as EdImages,
  ListDashes as EdListDashes,
  MagnifyingGlass as EdMagnifyingGlass,
  Megaphone as EdMegaphone,
  Minus as EdMinus,
  Newspaper as EdNewspaper,
  Package as EdPackage,
  Quotes as EdQuotes,
  Rows as EdRows,
  Shapes as EdShapes,
  Slideshow as EdSlideshow,
  Sparkle as EdSparkle,
  SquareSplitHorizontal as EdSplit,
  SquaresFour as EdSquaresFour,
  StarFour as EdStarFour,
  Tabs as EdTabs,
  Tag as EdTag,
  TextAlignLeft as EdTextAlignLeft,
  TextH as EdTextH,
  WarningCircle as EdWarningCircle,
  Eye,
  EyeClosed,
  FacebookLogo,
  FileText,
  Fire,
  Flag,
  FlowArrow,
  FolderOpen,
  Funnel,
  Gear,
  Gift,
  GlobeSimple,
  GoogleLogo,
  Hash,
  Highlighter,
  House,
  Image,
  ImageSquare,
  Info,
  InstagramLogo,
  Layout,
  LinkSimple,
  ListBullets,
  MagnifyingGlass,
  MagnifyingGlassMinus,
  MapPinLine,
  Megaphone,
  Minus,
  Moon,
  Newspaper,
  NotePencil,
  Package,
  PaperPlaneTilt,
  Paragraph,
  PencilSimpleLine,
  BookmarkSimple as PhBookmarkSimple,
  Clock as PhClock,
  Compass as PhCompass,
  Cookie as PhCookie,
  Diamond as PhDiamond,
  Globe as PhGlobe,
  HandHeart as PhHandHeart,
  Headphones as PhHeadphones,
  Images as PhImages,
  Lock as PhLock,
  Monitor as PhMonitor,
  Phone,
  Palette as PhPalette,
  ShoppingBag as PhShoppingBag,
  ShoppingCart as PhShoppingCart,
  Star as PhStar,
  StarHalf as PhStarHalf,
  Plus,
  Printer,
  PuzzlePiece,
  QrCode,
  Radio,
  Receipt,
  Rows,
  SealPercent,
  ShieldCheck,
  ShoppingBagOpen,
  SignOut,
  Sparkle,
  SpinnerGap,
  SquaresFour,
  Storefront,
  Sun,
  Swatches,
  Target,
  TerminalWindow,
  TextAlignLeft,
  TextT,
  ToggleLeft,
  Translate,
  Trash,
  Tray,
  TreeStructure,
  Truck,
  TShirt,
  Upload,
  User,
  UserCircle,
  UserGear,
  Users,
  Video,
  Warning,
  WarningCircle,
  WarningDiamond,
  WarningOctagon,
  WhatsappLogo,
  WifiSlash,
  X,
  XCircle,
  YoutubeLogo,
} from '@phosphor-icons/react/ssr'
import { defineIcon, definePath, type IconComponent } from './lib/icon'

export type { IconComponent, IconProps } from './lib/icon'
/** Legacy alias for call sites typed against Lucide. */
export type LucideIcon = IconComponent

/* Navigation: duotone weight, per the reference site's title/section icons. */
export const Home = defineIcon(House, 'Home', 'duotone')
export const ShoppingBag = defineIcon(PhShoppingBag, 'ShoppingBag', 'duotone') // kit nav: cart
export const ShoppingCart = defineIcon(PhShoppingCart, 'ShoppingCart', 'duotone')
export const Package_ = defineIcon(Package, 'Package', 'duotone')
export { Package_ as Package }
export const Users_ = defineIcon(Users, 'Users', 'duotone')
export { Users_ as Users }
export const FolderOpen_ = defineIcon(FolderOpen, 'FolderOpen', 'duotone') // kit nav: product media
export { FolderOpen_ as FolderOpen }
export const BarChart3 = defineIcon(ChartBar, 'BarChart3', 'duotone')
export const Megaphone_ = defineIcon(Megaphone, 'Megaphone', 'duotone')
export { Megaphone_ as Megaphone }
export const BadgePercent = defineIcon(SealPercent, 'BadgePercent', 'duotone') // kit nav: coupon code
export const Store = defineIcon(Storefront, 'Store', 'duotone')
export const Blocks = defineIcon(SquaresFour, 'Blocks', 'duotone') // kit nav: categories glyph
export const Puzzle = defineIcon(PuzzlePiece, 'Puzzle', 'duotone')
export const Settings = defineIcon(Gear, 'Settings', 'duotone') // kit nav: control authority
export const LayoutGrid = defineIcon(SquaresFour, 'LayoutGrid', 'duotone')
export const Boxes = defineIcon(Cube, 'Boxes', 'duotone')
export const Gift_ = defineIcon(Gift, 'Gift', 'duotone')
export { Gift_ as Gift }
export const Globe = defineIcon(GlobeSimple, 'Globe', 'duotone')
export const Newspaper_ = defineIcon(Newspaper, 'Newspaper', 'duotone')
export { Newspaper_ as Newspaper }
export const FileText_ = defineIcon(FileText, 'FileText', 'duotone')
export { FileText_ as FileText }
export const FileEdit = defineIcon(NotePencil, 'FileEdit', 'duotone')
export const FileBarChart = defineIcon(ChartBar, 'FileBarChart', 'duotone')
export const ClipboardList = defineIcon(ClipboardText, 'ClipboardList', 'duotone')
export const ListTree = defineIcon(TreeStructure, 'ListTree', 'duotone')
export const Braces = defineIcon(BracketsCurly, 'Braces', 'duotone')
export const Workflow = defineIcon(FlowArrow, 'Workflow', 'duotone')
export const Radio_ = defineIcon(Radio, 'Radio', 'duotone')
export { Radio_ as Radio }
export const Palette = defineIcon(PhPalette, 'Palette', 'duotone')
export const Monitor = defineIcon(PhMonitor, 'Monitor', 'duotone')
export const Tablet = defineIcon(DeviceTablet, 'Tablet', 'duotone')
export const Smartphone = defineIcon(DeviceMobile, 'Smartphone', 'duotone')
export const Images = defineIcon(PhImages, 'Images', 'duotone')
export const UserCog = defineIcon(UserGear, 'UserCog', 'duotone')
export const UserRound = defineIcon(User, 'UserRound', 'duotone')
/* Settings → Customer privacy and Settings → Customer accounts. */
export const ShieldCheck_ = defineIcon(ShieldCheck, 'ShieldCheck', 'duotone')
export { ShieldCheck_ as ShieldCheck }
export const UserCircle_ = defineIcon(UserCircle, 'UserCircle', 'duotone')
export { UserCircle_ as UserCircle }
export const CreditCard_ = defineIcon(CreditCard, 'CreditCard', 'duotone')
export { CreditCard_ as CreditCard }
export const Inbox = defineIcon(Tray, 'Inbox', 'duotone')
export const MessageSquare = defineIcon(ChatCircleText, 'MessageSquare', 'duotone')
export const Send = defineIcon(PaperPlaneTilt, 'Send', 'duotone')
export const TrendingUp = defineIcon(ChartLineUp, 'TrendingUp', 'duotone')

/* Brand marks for the Growth "sales by source" table: recognisable logos, no other use of the mark. */
export const InstagramLogo_ = defineIcon(InstagramLogo, 'InstagramLogo', 'duotone')
export { InstagramLogo_ as InstagramLogo }
export const FacebookLogo_ = defineIcon(FacebookLogo, 'FacebookLogo', 'duotone')
export { FacebookLogo_ as FacebookLogo }
export const YoutubeLogo_ = defineIcon(YoutubeLogo, 'YoutubeLogo', 'duotone')
export { YoutubeLogo_ as YoutubeLogo }
export const GoogleLogo_ = defineIcon(GoogleLogo, 'GoogleLogo', 'duotone')
export { GoogleLogo_ as GoogleLogo }
export const Phone_ = defineIcon(Phone, 'Phone', 'duotone')
export { Phone_ as Phone }
export const WhatsappLogo_ = defineIcon(WhatsappLogo, 'WhatsappLogo', 'duotone')
export { WhatsappLogo_ as WhatsappLogo }

/* AI features: Settings → AI, "Write with AI", "Ask your store". */
export const AiIcon = defineIcon(Sparkle, 'AiIcon', 'duotone')

/* Onboarding picture cards ("What do you sell?", "Do you already sell somewhere?"). */
export const Clothing = defineIcon(TShirt, 'Clothing', 'duotone')
export const Beauty = defineIcon(Sparkle, 'Beauty', 'duotone')
export const Jewellery = defineIcon(PhDiamond, 'Jewellery', 'duotone')
export const HomeDecor = defineIcon(Armchair, 'HomeDecor', 'duotone')
export const Electronics = defineIcon(PhHeadphones, 'Electronics', 'duotone')
export const FoodDrink = defineIcon(PhCookie, 'FoodDrink', 'duotone')
export const Handmade = defineIcon(PhHandHeart, 'Handmade', 'duotone')
export const SomethingElse = defineIcon(DotsThreeOutline, 'SomethingElse', 'duotone')
export const Website = defineIcon(PhGlobe, 'Website', 'duotone')
export const Marketplace = defineIcon(Basket, 'Marketplace', 'duotone')
export const NewShop = defineIcon(ShoppingBagOpen, 'NewShop', 'duotone')

/* Chrome: regular weight, 16px inline / 18px nav-header sizing set at call sites. */
export const Search = defineIcon(MagnifyingGlass, 'Search')
/** Theme editor: "Connect dynamic source" next to a setting, Shopify's database glyph. */
export const DynamicSource = defineIcon(Database, 'DynamicSource')
export const SearchIcon = Search
export const SearchX = defineIcon(MagnifyingGlassMinus, 'SearchX')
export const Bell = defineIcon(BellSimple, 'Bell')
export const BellDot = defineIcon(BellSimpleRinging, 'BellDot')
export const Sun_ = defineIcon(Sun, 'Sun')
export { Sun_ as Sun }
export const SunIcon = Sun_
export const Moon_ = defineIcon(Moon, 'Moon')
export { Moon_ as Moon }
export const MoonIcon = Moon_
export const LogOut = defineIcon(SignOut, 'LogOut') // kit user card
/* Page states: offline, no access, not found; and the language switch. */
export const WifiOff = defineIcon(WifiSlash, 'WifiOff')
export const Lock = defineIcon(PhLock, 'Lock')
export const Compass = defineIcon(PhCompass, 'Compass')
export const Language = defineIcon(Translate, 'Language')
/** "Report a bug" (test server only): the account menu item and the floating button. */
export const BugIcon = defineIcon(Bug, 'BugIcon')
/* Top bar panel toggle (Figma 223:414): a rounded box with a bar on the left. */
const PANEL_PATHS = [
  'M4.5 5.5h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z',
  'M9.5 5.5v13',
]
export const PanelLeftIcon = definePath(PANEL_PATHS, 'PanelLeftIcon')
export const ExternalLink = defineIcon(ArrowSquareOut, 'ExternalLink') // kit Your Shop

/* Arrows and chevrons */
export const ChevronDown = defineIcon(CaretDown, 'ChevronDown')
export const ChevronDownIcon = ChevronDown
export const ChevronUpIcon = defineIcon(CaretUp, 'ChevronUpIcon')
export const ChevronLeftIcon = defineIcon(CaretLeft, 'ChevronLeftIcon')
export const ChevronRightIcon = defineIcon(CaretRight, 'ChevronRightIcon')
/** Six-dot grip on a draggable row. */
export const GripVertical = defineIcon(DotsSix, 'GripVertical')
/** Small disclosure chevron, pointing right when collapsed. */
export const ChevronRight = defineIcon(CaretRight, 'ChevronRight')
export const LinkIcon = defineIcon(LinkSimple, 'LinkIcon')
export const ChevronsUpDown = defineIcon(CaretUpDown, 'ChevronsUpDown')
export const ArrowUp_ = defineIcon(ArrowUp, 'ArrowUp')
export { ArrowUp_ as ArrowUp }
export const ArrowDown_ = defineIcon(ArrowDown, 'ArrowDown')
export { ArrowDown_ as ArrowDown }
export const ArrowLeft_ = defineIcon(ArrowLeft, 'ArrowLeft')
export { ArrowLeft_ as ArrowLeft }
export const ArrowRight_ = defineIcon(ArrowRight, 'ArrowRight')
export { ArrowRight_ as ArrowRight }
export const ArrowUpDown = defineIcon(ArrowsLeftRight, 'ArrowUpDown')
export const ArrowLeftRight = defineIcon(ArrowsLeftRight, 'ArrowLeftRight')

/* Actions */
export const Plus_ = defineIcon(Plus, 'Plus')
export { Plus_ as Plus }
export const SquarePlus = Plus_
export const Minus_ = defineIcon(Minus, 'Minus')
export { Minus_ as Minus }
export const MoreHorizontal = defineIcon(DotsThree, 'MoreHorizontal')
export const MoreHorizontalIcon = MoreHorizontal
export const MoreVertical = defineIcon(DotsThreeVertical, 'MoreVertical')
export const Filter = defineIcon(Funnel, 'Filter')
export const SlidersHorizontal = Filter
export const Columns_ = defineIcon(Columns, 'Columns')
export { Columns_ as Columns }
export const SquareTerminal = defineIcon(TerminalWindow, 'SquareTerminal')
export const Pencil = defineIcon(PencilSimpleLine, 'Pencil')
export const Trash2 = defineIcon(Trash, 'Trash2')
export const ImagePlus = defineIcon(ImageSquare, 'ImagePlus')
export const ImageIcon = defineIcon(Image, 'ImageIcon')
/* Field-type glyphs for Customize's right panel (Puck fieldTypes overrides). */
export const FieldText = defineIcon(TextT, 'FieldText')
export const FieldTextarea = defineIcon(Paragraph, 'FieldTextarea')
export const FieldNumber = defineIcon(Hash, 'FieldNumber')
export const FieldToggle = defineIcon(ToggleLeft, 'FieldToggle')
export const FieldList = defineIcon(ListBullets, 'FieldList')
export const FieldSwatch = defineIcon(Swatches, 'FieldSwatch')
export const FieldRichText = defineIcon(TextAlignLeft, 'FieldRichText')
export const FieldGroup = defineIcon(SquaresFour, 'FieldGroup')
export const Video_ = defineIcon(Video, 'Video')
export { Video_ as Video }
export const Upload_ = defineIcon(Upload, 'Upload')
export { Upload_ as Upload }
export const Download = defineIcon(DownloadSimple, 'Download')
export const RefreshCw = defineIcon(ArrowClockwise, 'RefreshCw')
export const Save = defineIcon(DownloadSimple, 'Save') // kit "save-01" on Save to draft
export const RotateCcw = defineIcon(ArrowCounterClockwise, 'RotateCcw')
export const Printer_ = defineIcon(Printer, 'Printer')
export { Printer_ as Printer }
/** Theme editor: "Save as my section". */
export const Bookmark = defineIcon(PhBookmarkSimple, 'Bookmark')
export const Copy_ = defineIcon(Copy, 'Copy')
export { Copy_ as Copy }
export const EyeOff = defineIcon(EyeClosed, 'EyeOff')
export const Eye_ = defineIcon(Eye, 'Eye')
export { Eye_ as Eye }
export const Undo = defineIcon(ArrowUUpLeft, 'Undo')
export const Redo = defineIcon(ArrowUUpRight, 'Redo')
export const PanelTop = defineIcon(Layout, 'PanelTop')
export const PanelBottom = defineIcon(Rows, 'PanelBottom')
export const ListView = defineIcon(Rows, 'ListView')
export const X_ = defineIcon(X, 'X')
export { X_ as X }
export const XIcon = X_
export const CheckIcon = defineIcon(Check, 'CheckIcon')
export const Loader2Icon = defineIcon(SpinnerGap, 'Loader2Icon')

/* Status */
export const CircleCheck = defineIcon(CheckCircle, 'CircleCheck')
export const CircleCheckIcon = CircleCheck
export const CircleAlert = defineIcon(WarningCircle, 'CircleAlert')
export const InfoIcon = defineIcon(Info, 'InfoIcon')
export const TriangleAlert = defineIcon(Warning, 'TriangleAlert')
export const TriangleAlertIcon = defineIcon(WarningDiamond, 'TriangleAlertIcon')
export const OctagonXIcon = defineIcon(WarningOctagon, 'OctagonXIcon')
export const Truck_ = defineIcon(Truck, 'Truck')
export { Truck_ as Truck }
export const PackageCheck = defineIcon(CheckCircle, 'PackageCheck')
export const PackageOpen = defineIcon(Package, 'PackageOpen')
export const PackageX = defineIcon(XCircle, 'PackageX')
export const Clock = defineIcon(PhClock, 'Clock')
export const DeliveryDelay = defineIcon(Warning, 'DeliveryDelay') // kit status: Pending
export const CancelCircle = defineIcon(WarningOctagon, 'CancelCircle') // kit status: Cancelled
export const QrCodeIcon = defineIcon(QrCode, 'QrCodeIcon')
export const ReceiptIcon = defineIcon(Receipt, 'ReceiptIcon')
export const TargetIcon = defineIcon(Target, 'TargetIcon')
export const FireIcon = defineIcon(Fire, 'FireIcon')
export const MapPinLineIcon = defineIcon(MapPinLine, 'MapPinLineIcon')
export const WarningIcon = defineIcon(Warning, 'WarningIcon')
/** Rating stars (Content types "Rating" field); pass `weight="fill"` for a chosen star. */
export const StarIcon = defineIcon(PhStar, 'StarIcon')
export const StarHalfIcon = defineIcon(PhStarHalf, 'StarHalfIcon', 'fill')

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

/** Semantic map for new code. */
export const icons = {
  home: Home,
  orders: ShoppingBag,
  products: Package_,
  customers: Users_,
  content: FolderOpen_,
  analytics: BarChart3,
  marketing: Megaphone_,
  discounts: BadgePercent,
  store: Store,
  apps: Puzzle,
  settings: Settings,
  search: Search,
  bell: Bell,
  sun: Sun_,
  moon: Moon_,
  logout: LogOut,
  chevronDown: ChevronDown,
  chevronUp: ChevronUpIcon,
  chevronLeft: ChevronLeftIcon,
  chevronRight: ChevronRightIcon,
  plus: Plus_,
  kebab: MoreHorizontal,
  kebabVertical: MoreVertical,
  filter: Filter,
  sort: ArrowUpDown,
  export: Download,
  import: Upload_,
  truck: Truck_,
  delivered: PackageCheck,
  pending: Clock,
  cancelled: PackageX,
  edit: Pencil,
  trash: Trash2,
  upload: Upload_,
  image: ImageIcon,
  video: Video_,
  check: CheckIcon,
  close: X_,
  externalLink: ExternalLink,
  info: InfoIcon,
  warning: TriangleAlert,
  refresh: RefreshCw,
  copy: Copy_,
  print: Printer_,
  eye: EyeOff,
  spinner: Loader2Icon,
} as const

export { Circle, Flag, Highlighter, Sparkle }
