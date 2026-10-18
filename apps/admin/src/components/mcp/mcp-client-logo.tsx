import type { McpClientId } from '@commerce/core/api-access'
import {
  ChatGptLogo,
  ClaudeLogo,
  type LucideIcon,
  PlugConnect,
  VsCodeLogo,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

/** Cursor's cube mark; Hugeicons has none. */
function CursorLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2 3.5 7v10L12 22l8.5-5V7L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 7 12 12l8.5-5M12 12v10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 12 20.5 7 12 2v10Z" fill="currentColor" opacity="0.35" />
    </svg>
  )
}

const LOGOS: Record<McpClientId, LucideIcon | typeof CursorLogo> = {
  claude: ClaudeLogo,
  chatgpt: ChatGptLogo,
  cursor: CursorLogo,
  vscode: VsCodeLogo,
}

/** Brand colour where the mark has one (Claude's orange, VS Code's blue). */
const TINT: Partial<Record<McpClientId, string>> = {
  claude: 'text-[#d97757]',
  vscode: 'text-[#0078d4]',
}

type McpClientLogoProps = {
  client: McpClientId | null
  size?: 'sm' | 'lg'
  className?: string
}

/** An AI client's mark on a quiet tile (Figma "Connect a client"); a plug for unknown clients. */
export default function McpClientLogo({ client, size = 'sm', className }: McpClientLogoProps) {
  // Render logic
  const Icon = client ? LOGOS[client] : PlugConnect
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center border border-border bg-card text-foreground shadow-input',
        size === 'lg' ? 'size-14 rounded-xl [&_svg]:size-7' : 'size-8 rounded-lg [&_svg]:size-4.5',
        client ? TINT[client] : null,
        className,
      )}
    >
      <Icon className={size === 'lg' ? 'size-7' : 'size-4.5'} />
    </span>
  )
}
