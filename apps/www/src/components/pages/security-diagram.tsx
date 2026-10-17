import {
  Boxes,
  ChevronRight,
  Download,
  Globe,
  Lock,
  ShieldCheck_ as ShieldCheck,
  Store,
  UserCog,
  UserRound,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type ComponentType, Fragment } from 'react'
import { securityContent } from '@/data/security'

const copy = securityContent.diagram

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  shopper: UserRound,
  edge: Globe,
  apps: Store,
  access: UserCog,
  isolation: ShieldCheck,
  secrets: Lock,
  database: Boxes,
  backups: Download,
}

type DiagramNodeProps = { nodeKey: string; title: string; body: string; highlighted?: boolean }

function DiagramNode({ nodeKey, title, body, highlighted = false }: DiagramNodeProps) {
  const Icon = ICONS[nodeKey] ?? Globe
  return (
    <div
      className={cn(
        'surface-card flex w-full flex-col items-center gap-2 rounded-2xl p-4 text-center md:w-36',
        highlighted && 'ring-1 ring-foreground',
      )}
    >
      <span className="grid size-9 place-items-center rounded-lg border border-border bg-muted">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground">{body}</span>
    </div>
  )
}

export default function SecurityDiagram() {
  return (
    <figure className="surface-glass flex flex-col gap-8 rounded-3xl p-6 md:p-8">
      <figcaption className="flex flex-col justify-between gap-1 md:flex-row md:items-baseline">
        <span className="text-base font-semibold text-foreground">{copy.title}</span>
        <span className="text-xs text-muted-foreground">{copy.source}</span>
      </figcaption>
      <ol className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-0">
        {copy.nodes.map((node, index) => (
          <Fragment key={node.key}>
            <li className="flex">
              <DiagramNode
                nodeKey={node.key}
                title={node.title}
                body={node.body}
                highlighted={(copy.highlighted as readonly string[]).includes(node.key)}
              />
            </li>
            {index < copy.nodes.length - 1 ? (
              <li aria-hidden className="mx-auto">
                <ChevronRight className="size-4 shrink-0 rotate-90 text-muted-foreground md:rotate-0" />
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
      <div className="flex md:justify-end">
        <DiagramNode nodeKey={copy.backup.key} title={copy.backup.title} body={copy.backup.body} />
      </div>
    </figure>
  )
}
