import {
  CloudArrowUp,
  Database,
  ListChecks,
  PuzzlePiece,
  Rocket,
  ShieldWarning,
  Terminal,
  TestTube,
  TreeStructure,
} from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'

function navItem(icon: ReactNode, label: string) {
  return {
    title: (
      <span className="docs-nav-item">
        {icon}
        {label}
      </span>
    ),
  }
}

const iconProps = { size: 16, weight: 'light' as const }

export default {
  architecture: navItem(<TreeStructure {...iconProps} />, 'Architecture'),
  conventions: navItem(<ListChecks {...iconProps} />, 'Conventions'),
  guardrails: navItem(<ShieldWarning {...iconProps} />, 'Guardrails and sweeps'),
  plugins: navItem(<PuzzlePiece {...iconProps} />, 'Plugins SDK and app blocks'),
  'data-model': navItem(<Database {...iconProps} />, 'Data model'),
  'sep-run': { type: 'separator', title: 'Working locally' },
  'running-locally': navItem(<Terminal {...iconProps} />, 'Running locally'),
  testing: navItem(<TestTube {...iconProps} />, 'Testing'),
  backups: navItem(<CloudArrowUp {...iconProps} />, 'Backups'),
  deployment: navItem(<Rocket {...iconProps} />, 'Deployment'),
}
