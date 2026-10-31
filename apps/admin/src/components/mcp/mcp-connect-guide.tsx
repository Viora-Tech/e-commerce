'use client'

import type { McpClientId } from '@commerce/core/api-access'
import { ExternalLink, InfoIcon, Plus, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { type ReactNode, useState } from 'react'
import SettingsCard from '@/components/settings/settings-card'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'
import {
  claudeCodeCommand,
  clientInstallUrl,
  isPrivateMcpUrl,
  mcpJsonConfig,
  mcpServerName,
} from '@/lib/mcp'
import CodeSnippet from './code-snippet'
import McpCapabilities from './mcp-capabilities'
import McpClientLogo from './mcp-client-logo'

type McpConnectGuideProps = {
  serverUrl: string
  onCreateToken: () => void
}

type GuideId = 'claude' | 'claudeCode' | 'chatgpt' | 'cursor' | 'vscode' | 'other'

/** The guides in picker order, with the logo each shows and the app its Open button opens. */
const GUIDES: { id: GuideId; logo: McpClientId | null; opens: McpClientId | null }[] = [
  { id: 'claude', logo: 'claude', opens: 'claude' },
  { id: 'claudeCode', logo: 'claude', opens: null },
  { id: 'chatgpt', logo: 'chatgpt', opens: 'chatgpt' },
  { id: 'cursor', logo: 'cursor', opens: 'cursor' },
  { id: 'vscode', logo: 'vscode', opens: 'vscode' },
  { id: 'other', logo: null, opens: null },
]

/** Apps that call the server from their own cloud, so a private address cannot work. */
const WEB_APPS: GuideId[] = ['claude', 'chatgpt']

/** Apps that can send a token header when they cannot open a sign-in page. */
const TOKEN_APPS: GuideId[] = ['claudeCode', 'cursor', 'vscode', 'other']

const isGuide = (v: unknown): v is GuideId => GUIDES.some((g) => g.id === v)

/**
 * "Connect an AI app": one tab per app with its exact steps, the real server URL, and commands
 * or config to copy. Local apps also get the API-token route (header + a token in a dialog).
 */
export default function McpConnectGuide({ serverUrl, onCreateToken }: McpConnectGuideProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const [active, setActive] = useState<GuideId>('claude')

  // Helpers
  /* The server URL itself shows once, on the status card above; the steps hold commands only. */
  const extraFor = (id: GuideId, step: number): ReactNode => {
    if (id === 'claudeCode' && step === 0)
      return <CodeSnippet value={claudeCodeCommand(serverUrl)} what={copy.guide.copyWhat} />
    if ((id === 'cursor' || id === 'vscode') && step === 0)
      return <CodeSnippet value={mcpJsonConfig(id, serverUrl)} what={copy.guide.copyJson} />
    if (id === 'other' && step === 0)
      return <CodeSnippet value={mcpJsonConfig('generic', serverUrl)} what={copy.guide.copyJson} />
    if (id === 'other' && step === 1)
      return <CodeSnippet value={mcpJsonConfig('stdio', serverUrl)} what={copy.guide.copyJson} />
    return null
  }

  const tokenVariant = (id: GuideId): string => {
    const token = copy.guide.token.placeholder
    if (id === 'claudeCode') return claudeCodeCommand(serverUrl, token)
    if (id === 'cursor' || id === 'vscode') return mcpJsonConfig(id, serverUrl, token)
    return mcpJsonConfig('generic', serverUrl, token)
  }

  // Render logic
  const guide = GUIDES.find((g) => g.id === active) ?? GUIDES[0]
  const steps = copy.guide[active].steps
  const href = guide?.opens ? clientInstallUrl(guide.opens, serverUrl, mcpServerName) : null
  const external = href?.startsWith('https:') ?? false
  const openLabel =
    active === 'claude' || active === 'chatgpt' || active === 'cursor' || active === 'vscode'
      ? copy.guide[active].open
      : null
  const privateUrl = WEB_APPS.includes(active) && isPrivateMcpUrl(serverUrl)

  return (
    <SettingsCard title={copy.guide.heading} description={copy.guide.help} bodyClassName="gap-5">
      <Tabs value={active} onValueChange={(v) => (isGuide(v) ? setActive(v) : null)}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList variant="line" className="h-auto w-max gap-1">
            {GUIDES.map((g) => (
              <TabsTrigger key={g.id} value={g.id} className="h-9 flex-none gap-2 px-3">
                <McpClientLogo client={g.logo} className="size-5 rounded-md [&_svg]:size-3" />
                {copy.guide.tabs[g.id]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {privateUrl ? (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-caption text-warning-foreground dark:text-warning">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {copy.guide.privateUrl}
        </p>
      ) : null}

      <ol className="flex flex-col gap-5">
        {steps.map((step, i) => {
          const extra = extraFor(active, i)
          return (
            <li key={step.title} className="flex gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-caption font-medium tabular-nums">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body text-ink-strong">{step.title}</span>
                  {step.body ? (
                    <span className="text-caption text-muted-foreground">{step.body}</span>
                  ) : null}
                </div>
                {extra}
              </div>
            </li>
          )
        })}
      </ol>

      {active === 'chatgpt' ? (
        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {copy.guide.chatgpt.supported}
        </p>
      ) : null}

      {TOKEN_APPS.includes(active) ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-body text-ink-strong">{copy.guide.token.heading}</span>
            <span className="text-caption text-muted-foreground">{copy.guide.token.body}</span>
          </div>
          <CodeSnippet
            value={`Authorization: Bearer ${copy.guide.token.placeholder}`}
            what={copy.guide.copyHeader}
          />
          <CodeSnippet
            value={tokenVariant(active)}
            what={active === 'claudeCode' ? copy.guide.copyWhat : copy.guide.copyJson}
            label={copy.guide.token.withToken}
          />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onCreateToken}>
              <Plus aria-hidden="true" />
              {copy.guide.token.create}
            </Button>
          </div>
        </div>
      ) : null}

      {href && openLabel ? (
        <div className="flex justify-end">
          <Button
            nativeButton={false}
            render={
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              />
            }
          >
            {openLabel}
            {external ? <ExternalLink aria-hidden="true" /> : null}
          </Button>
        </div>
      ) : null}
      <McpCapabilities />
    </SettingsCard>
  )
}
