'use client'

// Port of sections/product-size-table.liquid + assets/size-units.js: a free-form measurement table, with a mm / cm / in switcher when its cells carry a length unit.
import { type ReactNode, useEffect, useState } from 'react'
import { productSizeTableContent as copy } from '../../../data/glide/product-size-table'

type Unit = (typeof copy.unitOptions)[number]

type ProductSizeTableProps = {
  heading: ReactNode
  /** The scroll region's accessible name: the heading when it is plain text, else a fixed label. */
  regionLabel: string
  note: ReactNode
  showUnits: boolean
  head: string[]
  rows: string[][]
}

const TO_MM: Record<Unit, number> = { mm: 1, cm: 10, in: 25.4 }
const UNIT_AT_END = /(mm|cm|in|inch|inches|")\s*$/i

const isUnit = (value: unknown): value is Unit =>
  typeof value === 'string' && Object.hasOwn(TO_MM, value)

const round = (value: number, unit: Unit) =>
  unit === 'in' ? Math.round(value * 100) / 100 : Math.round(value * 10) / 10

/** "56 - 60 cm" in another unit, or null when the cell is not a length. */
function convert(text: string, unit: Unit): string | null {
  const match = UNIT_AT_END.exec(text)
  if (!match?.[1]) return null
  const raw = match[1].toLowerCase()
  const from: Unit = raw === 'mm' || raw === 'cm' ? raw : 'in'
  const body = text.slice(0, text.length - match[0].length)
  if (!/\d/.test(body)) return null
  const converted = body.replace(/\d+(\.\d+)?/g, (n) =>
    String(round((Number.parseFloat(n) * TO_MM[from]) / TO_MM[unit], unit)),
  )
  return `${converted.trimEnd()} ${unit}`
}

function readSaved(): Unit | null {
  try {
    const saved = window.localStorage.getItem(copy.storageKey)
    return isUnit(saved) ? saved : null
  } catch {
    return null
  }
}

export default function ProductSizeTable({
  heading,
  regionLabel,
  note,
  showUnits,
  head,
  rows,
}: ProductSizeTableProps) {
  // Hooks
  // Cells print as typed until the shopper picks a unit (or one was remembered).
  const [unit, setUnit] = useState<Unit | null>(null)
  useEffect(() => {
    setUnit(readSaved())
  }, [])

  // Helpers
  const cell = (text: string) => (unit ? (convert(text, unit) ?? text) : text)

  // Event handlers
  const handlePick = (next: Unit) => {
    setUnit(next)
    try {
      window.localStorage.setItem(copy.storageKey, next)
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  }

  // Render logic
  const convertible = rows.some((r) => r.slice(1).some((c) => convert(c, 'mm') !== null))

  return (
    <div className="section-size-table">
      {heading ? <h2 className="size-table__heading text-caption">{heading}</h2> : null}
      {showUnits && convertible ? (
        <div className="size-units">
          <span className="size-units__label">{copy.units}</span>
          <span className="size-units__buttons">
            {copy.unitOptions.map((u) => (
              <button
                key={u}
                type="button"
                className={`size-units__button${u === unit ? ' is-active' : ''}`}
                aria-pressed={u === unit}
                onClick={() => handlePick(u)}
              >
                {u}
              </button>
            ))}
          </span>
        </div>
      ) : null}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must take focus so keyboards can scroll it. */}
      <section className="size-table__scroll" tabIndex={0} aria-label={regionLabel}>
        <table className="size-table">
          <thead>
            <tr>
              {head.map((h, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells of one text line; two may read the same.
                <th scope="col" key={i}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are lines of one text field.
              <tr key={r}>
                {row.map((c, i) =>
                  i === 0 ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells of one text line.
                    <th scope="row" key={i}>
                      {c}
                    </th>
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells of one text line.
                    <td key={i}>{cell(c)}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {note ? <p className="size-table__note">{note}</p> : null}
    </div>
  )
}
