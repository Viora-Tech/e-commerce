'use client'

import type { SignupField } from '@commerce/plugin-affiliates/settings'

type SignupFieldsProps = {
  fields: SignupField[]
  values: Record<string, string | boolean>
  onChange: (id: string, value: string | boolean) => void
}

/** A program's own signup questions, after name and where they post. */
export default function SignupFields({ fields, values, onChange }: SignupFieldsProps) {
  // Render logic
  return (
    <>
      {fields.map((f) => {
        const label = `${f.label}${f.required ? ' *' : ''}`
        const value = values[f.id]
        if (f.kind === 'checkbox')
          return (
            <label key={f.id} className="flex items-center gap-3 text-body">
              <input
                type="checkbox"
                className="size-4"
                checked={value === true}
                onChange={(e) => onChange(f.id, e.target.checked)}
              />
              {label}
            </label>
          )
        return (
          <div key={f.id} className="field">
            <label htmlFor={`aff-q-${f.id}`} className="field__label text-small">
              {label}
            </label>
            {f.kind === 'textarea' ? (
              <textarea
                id={`aff-q-${f.id}`}
                className="field__input min-h-[5rem]"
                maxLength={1000}
                required={f.required}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(f.id, e.target.value)}
              />
            ) : f.kind === 'select' ? (
              <select
                id={`aff-q-${f.id}`}
                className="field__input"
                required={f.required}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(f.id, e.target.value)}
              >
                <option value="" />
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`aff-q-${f.id}`}
                className="field__input"
                type={f.kind === 'url' ? 'url' : f.kind === 'number' ? 'number' : 'text'}
                maxLength={1000}
                required={f.required}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(f.id, e.target.value)}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
