/**
 * Every icon the admin and shared components use, as Hugeicons glyphs (free Stroke Rounded set, MIT).
 * Named exports keep the identifiers call sites already use; `icons` groups
 * them by meaning for new code. Add here, never import a glyph pack directly.
 */

import * as Huge from '@hugeicons/core-free-icons'
import {
  Sofa01Icon as Armchair,
  RefreshIcon as ArrowClockwise,
  ArrowLeft02Icon as ArrowLeft,
  ArrowRight02Icon as ArrowRight,
  LinkSquare02Icon as ArrowSquareOut,
  ArrowDataTransferHorizontalIcon as ArrowsLeftRight,
  ArrowUp02Icon as ArrowUp,
  Notification01Icon as BellSimple,
  CodeIcon as BracketsCurly,
  Bug01Icon as Bug,
  ArrowDown01Icon as CaretDown,
  ArrowLeft01Icon as CaretLeft,
  ArrowRight01Icon as CaretRight,
  ArrowUp01Icon as CaretUp,
  UnfoldMoreIcon as CaretUpDown,
  Tick02Icon as Check,
  CheckmarkCircle02Icon as CheckCircle,
  Copy01Icon as Copy,
  CreditCardIcon as CreditCard,
  CubeIcon as Cube,
  SmartPhone01Icon as DeviceMobile,
  Tablet01Icon as DeviceTablet,
  DragDropVerticalIcon as DotsSix,
  MoreHorizontalIcon as DotsThree,
  MoreHorizontalCircle01Icon as DotsThreeOutline,
  MoreVerticalIcon as DotsThreeVertical,
  Download01Icon as DownloadSimple,
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
  ViewIcon as Eye,
  FireIcon as Fire,
  FilterIcon as Funnel,
  GiftIcon as Gift,
  Globe02Icon as GlobeSimple,
  GoogleIcon as GoogleLogo,
  Home01Icon as House,
  Image01Icon as Image,
  InformationCircleIcon as Info,
  InstagramIcon as InstagramLogo,
  Link01Icon as LinkSimple,
  LeftToRightListBulletIcon as ListBullets,
  Search01Icon as MagnifyingGlass,
  SearchRemoveIcon as MagnifyingGlassMinus,
  Location01Icon as MapPinLine,
  Megaphone01Icon as Megaphone,
  MinusSignIcon as Minus,
  Moon02Icon as Moon,
  News01Icon as Newspaper,
  PackageIcon as Package,
  SentIcon as PaperPlaneTilt,
  Bookmark02Icon as PhBookmarkSimple,
  Clock01Icon as PhClock,
  Compass01Icon as PhCompass,
  HeadphonesIcon as PhHeadphones,
  Image02Icon as PhImages,
  LockIcon as PhLock,
  ComputerIcon as PhMonitor,
  Call02Icon as Phone,
  PaintBoardIcon as PhPalette,
  ShoppingBag01Icon as PhShoppingBag,
  ShoppingCart01Icon as PhShoppingCart,
  StarIcon as PhStar,
  StarHalfIcon as PhStarHalf,
  PrinterIcon as Printer,
  PuzzleIcon as PuzzlePiece,
  QrCodeIcon as QrCode,
  Invoice01Icon as Receipt,
  DiscountTag01Icon as SealPercent,
  SparklesIcon as Sparkle,
  Loading03Icon as SpinnerGap,
  Store01Icon as Storefront,
  Sun03Icon as Sun,
  Target02Icon as Target,
  ComputerTerminal01Icon as TerminalWindow,
  TranslateIcon as Translate,
  Delete02Icon as Trash,
  InboxIcon as Tray,
  HierarchyIcon as TreeStructure,
  DeliveryTruck01Icon as Truck,
  TShirtIcon as TShirt,
  Upload01Icon as Upload,
  UserIcon as User,
  UserCircleIcon as UserCircle,
  UserSettings01Icon as UserGear,
  UserGroupIcon as Users,
  Video01Icon as Video,
  Alert02Icon as Warning,
  AlertCircleIcon as WarningCircle,
  WhatsappIcon as WhatsappLogo,
  WifiOff01Icon as WifiSlash,
  Cancel01Icon as X,
  YoutubeIcon as YoutubeLogo,
} from '@hugeicons/core-free-icons'
import { defineIcon, type IconComponent } from './lib/icon'

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
export const FolderOpen_ = defineIcon(Huge.Folder01Icon, 'FolderOpen', 'duotone') // kit nav: product media
export { FolderOpen_ as FolderOpen }
export const BarChart3 = defineIcon(Huge.Analytics01Icon, 'BarChart3', 'duotone')
export const Megaphone_ = defineIcon(Megaphone, 'Megaphone', 'duotone')
export { Megaphone_ as Megaphone }
export const BadgePercent = defineIcon(SealPercent, 'BadgePercent', 'duotone') // kit nav: coupon code
export const Store = defineIcon(Storefront, 'Store', 'duotone')
export const Blocks = defineIcon(Huge.DashboardSquare01Icon, 'Blocks', 'duotone') // kit nav: categories glyph
export const Puzzle = defineIcon(PuzzlePiece, 'Puzzle', 'duotone')
export const Settings = defineIcon(Huge.Settings01Icon, 'Settings', 'duotone') // kit nav: control authority
export const LayoutGrid = defineIcon(Huge.GridViewIcon, 'LayoutGrid', 'duotone')
export const Boxes = defineIcon(Cube, 'Boxes', 'duotone')
export const Gift_ = defineIcon(Gift, 'Gift', 'duotone')
export { Gift_ as Gift }
export const Globe = defineIcon(GlobeSimple, 'Globe', 'duotone')
export const Newspaper_ = defineIcon(Newspaper, 'Newspaper', 'duotone')
export { Newspaper_ as Newspaper }
export const FileText_ = defineIcon(Huge.File01Icon, 'FileText', 'duotone')
export { FileText_ as FileText }
export const FileEdit = defineIcon(Huge.FileEditIcon, 'FileEdit', 'duotone')
export const FileBarChart = defineIcon(Huge.Analytics02Icon, 'FileBarChart', 'duotone')
export const ClipboardList = defineIcon(Huge.Task01Icon, 'ClipboardList', 'duotone')
export const ListTree = defineIcon(TreeStructure, 'ListTree', 'duotone')
export const Braces = defineIcon(BracketsCurly, 'Braces', 'duotone')
export const Workflow = defineIcon(Huge.WorkflowSquare01Icon, 'Workflow', 'duotone')
export const Radio_ = defineIcon(Huge.Radio01Icon, 'Radio', 'duotone')
export { Radio_ as Radio }
export const Palette = defineIcon(PhPalette, 'Palette', 'duotone')
export const Monitor = defineIcon(PhMonitor, 'Monitor', 'duotone')
export const Tablet = defineIcon(DeviceTablet, 'Tablet', 'duotone')
export const Smartphone = defineIcon(DeviceMobile, 'Smartphone', 'duotone')
export const Images = defineIcon(PhImages, 'Images', 'duotone')
export const UserCog = defineIcon(UserGear, 'UserCog', 'duotone')
export const UserRound = defineIcon(User, 'UserRound', 'duotone')
/* Settings → Customer privacy and Settings → Customer accounts. */
export const ShieldCheck_ = defineIcon(Huge.SecurityCheckIcon, 'ShieldCheck', 'duotone')
export { ShieldCheck_ as ShieldCheck }
export const UserCircle_ = defineIcon(UserCircle, 'UserCircle', 'duotone')
export { UserCircle_ as UserCircle }
export const CreditCard_ = defineIcon(CreditCard, 'CreditCard', 'duotone')
export { CreditCard_ as CreditCard }
export const Inbox = defineIcon(Tray, 'Inbox', 'duotone')
export const MessageSquare = defineIcon(Huge.Message01Icon, 'MessageSquare', 'duotone')
export const Send = defineIcon(PaperPlaneTilt, 'Send', 'duotone')
export const TrendingUp = defineIcon(Huge.ChartUpIcon, 'TrendingUp', 'duotone')

/* Brand marks for the Growth "sales by source" table: recognisable logos, no other use of the mark. */
export const InstagramLogo_ = defineIcon(InstagramLogo, 'InstagramLogo', 'duotone')
export { InstagramLogo_ as InstagramLogo }
export const FacebookLogo_ = defineIcon(Huge.Facebook01Icon, 'FacebookLogo', 'duotone')
export { FacebookLogo_ as FacebookLogo }
export const YoutubeLogo_ = defineIcon(YoutubeLogo, 'YoutubeLogo', 'duotone')
export { YoutubeLogo_ as YoutubeLogo }
export const GoogleLogo_ = defineIcon(GoogleLogo, 'GoogleLogo', 'duotone')
export { GoogleLogo_ as GoogleLogo }
export const Phone_ = defineIcon(Phone, 'Phone', 'duotone')
export { Phone_ as Phone }
export const WhatsappLogo_ = defineIcon(WhatsappLogo, 'WhatsappLogo', 'duotone')
export { WhatsappLogo_ as WhatsappLogo }

/* Sales channels: AI agents that sell the catalog, and the nav glyphs for the two sections. */
export const ChatGptLogo = defineIcon(Huge.ChatGptIcon, 'ChatGptLogo', 'duotone')
export const PerplexityLogo = defineIcon(Huge.PerplexityAiIcon, 'PerplexityLogo', 'duotone')
export const CopilotLogo = defineIcon(Huge.CopilotIcon, 'CopilotLogo', 'duotone')
/* AI clients on Settings → MCP & API. */
export const ClaudeLogo = defineIcon(Huge.ClaudeIcon, 'ClaudeLogo', 'duotone')
export const VsCodeLogo = defineIcon(Huge.VisualStudioCodeIcon, 'VsCodeLogo', 'duotone')
export const AgenticSales = defineIcon(Huge.AiBrain01Icon, 'AgenticSales', 'duotone')
export const SocialMedia = defineIcon(Huge.Share08Icon, 'SocialMedia', 'duotone')
export const PlugConnect = defineIcon(Huge.Plug01Icon, 'PlugConnect', 'duotone')

/* AI features: Settings → AI, "Write with AI", "Ask your store". */
export const AiIcon = defineIcon(Sparkle, 'AiIcon', 'duotone')

/* Onboarding picture cards ("What do you sell?", "Do you already sell somewhere?"). */
export const Clothing = defineIcon(TShirt, 'Clothing', 'duotone')
export const Beauty = defineIcon(Huge.PerfumeIcon, 'Beauty', 'duotone')
export const Jewellery = defineIcon(Huge.Diamond01Icon, 'Jewellery', 'duotone')
export const HomeDecor = defineIcon(Armchair, 'HomeDecor', 'duotone')
export const Electronics = defineIcon(PhHeadphones, 'Electronics', 'duotone')
export const FoodDrink = defineIcon(Huge.CoffeeIcon, 'FoodDrink', 'duotone')
export const Handmade = defineIcon(Huge.PaintBrush01Icon, 'Handmade', 'duotone')
export const SomethingElse = defineIcon(DotsThreeOutline, 'SomethingElse', 'duotone')
export const Website = defineIcon(Huge.BrowserIcon, 'Website', 'duotone')
export const Marketplace = defineIcon(Huge.MarketAnalysisIcon, 'Marketplace', 'duotone')
export const NewShop = defineIcon(Huge.StoreAdd01Icon, 'NewShop', 'duotone')

/* Chrome: regular weight, 16px inline / 18px nav-header sizing set at call sites. */
export const Search = defineIcon(MagnifyingGlass, 'Search')
/** Theme editor: "Connect dynamic source" next to a setting, Shopify's database glyph. */
export const DynamicSource = defineIcon(Huge.DatabaseIcon, 'DynamicSource')
export const SearchIcon = Search
export const SearchX = defineIcon(MagnifyingGlassMinus, 'SearchX')
export const Bell = defineIcon(BellSimple, 'Bell')
export const BellDot = defineIcon(Huge.NotificationSquareIcon, 'BellDot')
export const Sun_ = defineIcon(Sun, 'Sun')
export { Sun_ as Sun }
export const SunIcon = Sun_
export const Moon_ = defineIcon(Moon, 'Moon')
export { Moon_ as Moon }
export const MoonIcon = Moon_
export const LogOut = defineIcon(Huge.Logout01Icon, 'LogOut') // kit user card
/* Page states: offline, no access, not found; and the language switch. */
export const WifiOff = defineIcon(WifiSlash, 'WifiOff')
export const Lock = defineIcon(PhLock, 'Lock')
export const Compass = defineIcon(PhCompass, 'Compass')
export const Language = defineIcon(Translate, 'Language')
/** "Report a bug" (test server only): the account menu item and the floating button. */
export const BugIcon = defineIcon(Bug, 'BugIcon')
/* Top bar panel toggle (Figma 223:414): a rounded box with a bar on the left. */
/** The top bar's sidebar toggle: Figma "Icon/PanelLeft" (568:591) is Hugeicons sidebar-left. */
export const PanelLeftIcon = defineIcon(Huge.SidebarLeftIcon, 'PanelLeftIcon')
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
export const ArrowDown_ = defineIcon(Huge.ArrowDown02Icon, 'ArrowDown')
export { ArrowDown_ as ArrowDown }
export const ArrowLeft_ = defineIcon(ArrowLeft, 'ArrowLeft')
export { ArrowLeft_ as ArrowLeft }
export const ArrowRight_ = defineIcon(ArrowRight, 'ArrowRight')
export { ArrowRight_ as ArrowRight }
export const ArrowUpDown = defineIcon(Huge.ArrowDataTransferVerticalIcon, 'ArrowUpDown')
export const ArrowLeftRight = defineIcon(ArrowsLeftRight, 'ArrowLeftRight')

/* Actions */
export const Plus_ = defineIcon(Huge.Add01Icon, 'Plus')
export { Plus_ as Plus }
export const SquarePlus = Plus_
export const Minus_ = defineIcon(Minus, 'Minus')
export { Minus_ as Minus }
export const MoreHorizontal = defineIcon(DotsThree, 'MoreHorizontal')
export const MoreHorizontalIcon = MoreHorizontal
export const MoreVertical = defineIcon(DotsThreeVertical, 'MoreVertical')
export const Filter = defineIcon(Funnel, 'Filter')
export const SlidersHorizontal = Filter
export const Columns_ = defineIcon(Huge.LayoutThreeColumnIcon, 'Columns')
export { Columns_ as Columns }
export const SquareTerminal = defineIcon(TerminalWindow, 'SquareTerminal')
export const Pencil = defineIcon(Huge.PencilEdit01Icon, 'Pencil')
export const Trash2 = defineIcon(Trash, 'Trash2')
export const ImagePlus = defineIcon(Huge.ImageAdd01Icon, 'ImagePlus')
export const ImageIcon = defineIcon(Image, 'ImageIcon')
/* Field-type glyphs for Customize's right panel (Puck fieldTypes overrides). */
export const FieldText = defineIcon(Huge.TextIcon, 'FieldText')
export const FieldTextarea = defineIcon(Huge.TextAlignLeftIcon, 'FieldTextarea')
export const FieldNumber = defineIcon(Huge.HashtagIcon, 'FieldNumber')
export const FieldToggle = defineIcon(Huge.ToggleOnIcon, 'FieldToggle')
export const FieldList = defineIcon(ListBullets, 'FieldList')
export const FieldSwatch = defineIcon(Huge.ColorPickerIcon, 'FieldSwatch')
export const FieldRichText = defineIcon(Huge.TextBoldIcon, 'FieldRichText')
export const FieldGroup = defineIcon(Huge.LayersIcon, 'FieldGroup')
export const Video_ = defineIcon(Video, 'Video')
export { Video_ as Video }
export const Upload_ = defineIcon(Upload, 'Upload')
export { Upload_ as Upload }
export const Download = defineIcon(DownloadSimple, 'Download')
export const RefreshCw = defineIcon(ArrowClockwise, 'RefreshCw')
export const Save = defineIcon(Huge.FloppyDiskIcon, 'Save') // kit "save-01" on Save to draft
export const RotateCcw = defineIcon(Huge.RotateLeft01Icon, 'RotateCcw')
export const Printer_ = defineIcon(Printer, 'Printer')
export { Printer_ as Printer }
/** Theme editor: "Save as my section". */
export const Bookmark = defineIcon(PhBookmarkSimple, 'Bookmark')
export const Copy_ = defineIcon(Copy, 'Copy')
export { Copy_ as Copy }
export const EyeOff = defineIcon(Huge.ViewOffIcon, 'EyeOff')
export const Eye_ = defineIcon(Eye, 'Eye')
export { Eye_ as Eye }
export const Undo = defineIcon(Huge.Undo02Icon, 'Undo')
export const Redo = defineIcon(Huge.Redo02Icon, 'Redo')
export const PanelTop = defineIcon(Huge.LayoutTopIcon, 'PanelTop')
export const PanelBottom = defineIcon(Huge.LayoutBottomIcon, 'PanelBottom')
export const ListView = defineIcon(Huge.ListViewIcon, 'ListView')
export const X_ = defineIcon(X, 'X')
export { X_ as X }
export const XIcon = X_
export const CheckIcon = defineIcon(Check, 'CheckIcon')
export const MinusIcon = defineIcon(Minus, 'MinusIcon')
export const Loader2Icon = defineIcon(SpinnerGap, 'Loader2Icon')

/* Status */
export const CircleCheck = defineIcon(CheckCircle, 'CircleCheck')
export const CircleCheckIcon = CircleCheck
export const CircleDashed = defineIcon(Huge.CircleDashedIcon, 'CircleDashed')
export const Folder = defineIcon(Huge.Folder01Icon, 'Folder')
export const Database = defineIcon(Huge.DatabaseIcon, 'Database')
export const CircleAlert = defineIcon(WarningCircle, 'CircleAlert')
export const InfoIcon = defineIcon(Info, 'InfoIcon')
export const TriangleAlert = defineIcon(Warning, 'TriangleAlert')
export const TriangleAlertIcon = defineIcon(Huge.Alert02Icon, 'TriangleAlertIcon')
export const OctagonXIcon = defineIcon(Huge.CancelCircleIcon, 'OctagonXIcon')
export const Truck_ = defineIcon(Truck, 'Truck')
export { Truck_ as Truck }
export const PackageCheck = defineIcon(Huge.PackageDeliveredIcon, 'PackageCheck')
export const PackageOpen = defineIcon(Huge.PackageOpenIcon, 'PackageOpen')
export const PackageX = defineIcon(Huge.PackageRemoveIcon, 'PackageX')
export const Clock = defineIcon(PhClock, 'Clock')
export const DeliveryDelay = defineIcon(Huge.DeliveryDelay01Icon, 'DeliveryDelay') // kit status: Pending
export const CancelCircle = defineIcon(Huge.CancelCircleIcon, 'CancelCircle') // kit status: Cancelled
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

export * from './icons-more'
