import { siteConfig } from '@commerce/config/site'
import { BookOpenText, Compass, Hammer, Lightbulb, Wrench } from '@phosphor-icons/react/ssr'
import NavTitle from '../../components/nav-title'
import SectionSwitcher from '../../components/section-switcher'

export default {
  switcher: { type: 'separator', title: <SectionSwitcher current="developer" /> },
  'how-it-works': {
    title: (
      <NavTitle icon={<BookOpenText weight="light" />}>How {siteConfig.brand.name} works</NavTitle>
    ),
  },
  'getting-started': {
    title: <NavTitle icon={<Compass weight="light" />}>Getting started</NavTitle>,
  },
  'core-concepts': {
    title: <NavTitle icon={<Lightbulb weight="light" />}>Core concepts</NavTitle>,
  },
  building: { title: <NavTitle icon={<Hammer weight="light" />}>Building</NavTitle> },
  operations: { title: <NavTitle icon={<Wrench weight="light" />}>Operations</NavTitle> },
}
