import {
  ChartBar,
  FolderOpen,
  GearSix,
  HouseSimple,
  Lifebuoy,
  Package,
  PuzzlePiece,
  Receipt,
  Rocket,
  SealPercent,
  ShoppingBag,
  Storefront,
  TrendUp,
  Users,
  Warehouse,
} from '@phosphor-icons/react/ssr'
import NavTitle from '../../components/nav-title'
import SectionSwitcher from '../../components/section-switcher'

/* Same order, and the same labels, as the admin sidebar (apps/admin/src/data/navigation.ts). */
export default {
  switcher: { type: 'separator', title: <SectionSwitcher current="merchant" /> },
  'start-here': { title: <NavTitle icon={<Rocket weight="light" />}>Start here</NavTitle> },
  home: { title: <NavTitle icon={<HouseSimple weight="light" />}>Home</NavTitle> },
  orders: { title: <NavTitle icon={<ShoppingBag weight="light" />}>Orders</NavTitle> },
  products: { title: <NavTitle icon={<Package weight="light" />}>Products</NavTitle> },
  stock: { title: <NavTitle icon={<Warehouse weight="light" />}>Stock</NavTitle> },
  customers: { title: <NavTitle icon={<Users weight="light" />}>Customers</NavTitle> },
  content: { title: <NavTitle icon={<FolderOpen weight="light" />}>Content</NavTitle> },
  analytics: { title: <NavTitle icon={<ChartBar weight="light" />}>Analytics</NavTitle> },
  growth: { title: <NavTitle icon={<TrendUp weight="light" />}>Growth</NavTitle> },
  discounts: { title: <NavTitle icon={<SealPercent weight="light" />}>Discounts</NavTitle> },
  'online-store': { title: <NavTitle icon={<Storefront weight="light" />}>Online store</NavTitle> },
  apps: { title: <NavTitle icon={<PuzzlePiece weight="light" />}>Apps</NavTitle> },
  'money-and-gst': { title: <NavTitle icon={<Receipt weight="light" />}>Money & GST</NavTitle> },
  settings: { title: <NavTitle icon={<GearSix weight="light" />}>Settings</NavTitle> },
  help: { title: <NavTitle icon={<Lifebuoy weight="light" />}>Help</NavTitle> },
}
