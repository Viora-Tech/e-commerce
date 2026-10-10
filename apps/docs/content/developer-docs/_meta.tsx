import { Compass, Hammer, Lightbulb, Wrench } from '@phosphor-icons/react/ssr'
import NavTitle from '../../components/nav-title'
import SectionSwitcher from '../../components/section-switcher'

export default {
  switcher: { type: 'separator', title: <SectionSwitcher current="developer" /> },
  'getting-started': {
    title: <NavTitle icon={<Compass weight="light" />}>Getting started</NavTitle>,
  },
  'core-concepts': {
    title: <NavTitle icon={<Lightbulb weight="light" />}>Core concepts</NavTitle>,
  },
  building: { title: <NavTitle icon={<Hammer weight="light" />}>Building</NavTitle> },
  operations: { title: <NavTitle icon={<Wrench weight="light" />}>Operations</NavTitle> },
}
