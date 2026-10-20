'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import SettingsRow from '@/components/settings/settings-row'

type SecretRowProps = {
  id: string
  copy: { label: string; help: string; placeholder: string; saved: string; remove: string }
  value: string
  /** A value is stored on the server (never shown again). */
  saved: boolean
  busy: boolean
  removing: boolean
  onChange: (value: string) => void
  onRemove: () => void
}

/** A password field for a token the server keeps encrypted, with "saved" and a remove link. */
export default function SecretRow({
  id,
  copy,
  value,
  saved,
  busy,
  removing,
  onChange,
  onRemove,
}: SecretRowProps) {
  // Render logic
  return (
    <SettingsRow label={copy.label} description={copy.help} htmlFor={id}>
      <Input
        id={id}
        type="password"
        autoComplete="off"
        placeholder={copy.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {saved ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          {copy.saved}
          <Button
            variant="link"
            size="xs"
            className="h-auto p-0 text-destructive"
            loading={removing}
            disabled={busy}
            onClick={onRemove}
          >
            {copy.remove}
          </Button>
        </span>
      ) : null}
    </SettingsRow>
  )
}
