import {
  BookOpenText,
  CreditCard,
  Flag,
  GearSix,
  ListChecks,
  Package,
  Rocket,
  Sparkle,
  Storefront,
} from '@phosphor-icons/react/ssr'
import NavTitle from '../../components/nav-title'
import SectionSwitcher from '../../components/section-switcher'

export default {
  switcher: { type: 'separator', title: <SectionSwitcher current="merchant" /> },
  index: { title: <NavTitle icon={<Rocket weight="light" />}>Getting started</NavTitle> },
  'set-up-your-store': {
    title: <NavTitle icon={<ListChecks weight="light" />}>Set up your store</NavTitle>,
  },
  'going-live': { title: <NavTitle icon={<Flag weight="light" />}>Going live</NavTitle> },
  'ai-assistant': { title: <NavTitle icon={<Sparkle weight="light" />}>AI assistant</NavTitle> },
  settings: { title: <NavTitle icon={<GearSix weight="light" />}>Settings</NavTitle> },
  catalog: { title: <NavTitle icon={<Package weight="light" />}>Products and orders</NavTitle> },
  selling: { title: <NavTitle icon={<Storefront weight="light" />}>Selling</NavTitle> },
  money: { title: <NavTitle icon={<CreditCard weight="light" />}>Money and GST</NavTitle> },
  reference: { title: <NavTitle icon={<BookOpenText weight="light" />}>Reference</NavTitle> },
}
