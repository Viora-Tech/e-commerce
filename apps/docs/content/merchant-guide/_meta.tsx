import { CreditCard, Package, Rocket, Storefront } from '@phosphor-icons/react/ssr'
import NavTitle from '../../components/nav-title'
import SectionSwitcher from '../../components/section-switcher'

export default {
  switcher: { type: 'separator', title: <SectionSwitcher current="merchant" /> },
  index: { title: <NavTitle icon={<Rocket weight="light" />}>Getting started</NavTitle> },
  catalog: { title: <NavTitle icon={<Package weight="light" />}>Products and orders</NavTitle> },
  selling: { title: <NavTitle icon={<Storefront weight="light" />}>Selling</NavTitle> },
  money: { title: <NavTitle icon={<CreditCard weight="light" />}>Money and GST</NavTitle> },
}
