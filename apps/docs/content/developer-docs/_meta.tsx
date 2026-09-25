import { Sparkle, Stack, Terminal } from '@phosphor-icons/react/ssr'
import NavTitle from '../../components/nav-title'
import SectionSwitcher from '../../components/section-switcher'

export default {
  switcher: { type: 'separator', title: <SectionSwitcher current="developer" /> },
  building: { title: <NavTitle icon={<Stack weight="light" />}>Building</NavTitle> },
  operations: { title: <NavTitle icon={<Terminal weight="light" />}>Working locally</NavTitle> },
  'whats-new': {
    title: <NavTitle icon={<Sparkle weight="light" />}>What's new</NavTitle>,
    href: '/merchant-guide/reference/whats-new',
  },
}
