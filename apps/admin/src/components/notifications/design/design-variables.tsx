'use client'

import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'

type DesignVariablesProps = {
  variables: readonly string[]
  /** Words typed in the selected block that this email cannot fill. */
  unknown: string[]
}

/** The `{{words}}` this email can fill in, and a warning for any it cannot. */
export default function DesignVariables({ variables, unknown }: DesignVariablesProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Render logic
  const v = copy.variables

  return (
    <section aria-label={v.title} className="flex flex-col gap-1.5">
      <h3 className="text-caption font-semibold text-muted-foreground">{v.title}</h3>
      <p className="text-caption text-muted-foreground">{v.help}</p>
      {unknown.length > 0 ? (
        <p role="alert" className="text-caption font-medium text-destructive">
          {v.unknown(unknown.map((n) => `{{${n}}}`).join(', '))}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-1">
        {variables.map((name) => (
          <li
            key={name}
            title={v.names[name] ?? name}
            className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-caption text-foreground"
          >
            {`{{${name}}}`}
          </li>
        ))}
      </ul>
    </section>
  )
}
