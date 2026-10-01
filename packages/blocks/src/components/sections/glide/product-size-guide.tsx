'use client'

// Port of sections/product-size-guide.liquid + assets/product-size-guide.js: one card per size, and a slider that marks the size whose range is nearest the shopper's measurement.
import { type ChangeEvent, type ReactNode, useState } from 'react'
import { productSizeGuideContent as copy } from '../../../data/glide/product-size-guide'
import type { SizeGuideRow } from '../../../product-data'

type ProductSizeGuideProps = {
  id: string
  heading: ReactNode
  note: ReactNode
  labels: { measure: string; unit: string; dims: string; tags: string; weight: string }
  sizes: SizeGuideRow[]
}

/** Distance from a value to a range; zero inside it. */
const distance = (value: number, range: { min: number; max: number }) =>
  value < range.min ? range.min - value : value > range.max ? value - range.max : 0

function bounds(sizes: SizeGuideRow[]) {
  const ranges = sizes.flatMap((s) => (s.range ? [s.range] : []))
  if (ranges.length === 0) return null
  const low = Math.min(...ranges.map((r) => r.min))
  const high = Math.max(...ranges.map((r) => r.max))
  return { min: Math.floor(low - 1), max: Math.ceil(high + 1), start: (low + high) / 2 }
}

export default function ProductSizeGuide({
  id,
  heading,
  note,
  labels,
  sizes,
}: ProductSizeGuideProps) {
  // Hooks
  const [value, setValue] = useState<number | null>(null)

  // Event handlers
  const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
    setValue(Number.parseFloat(event.target.value))

  // Render logic
  const range = bounds(sizes)
  const current = value ?? range?.start ?? 0
  const best = range
    ? sizes.reduce<number>((at, size, i) => {
        const prev = sizes[at]?.range
        if (!size.range) return at
        return !prev || distance(current, size.range) < distance(current, prev) ? i : at
      }, -1)
    : -1

  return (
    <div className="size-guide">
      {heading ? <h2 className="size-guide__heading text-caption">{heading}</h2> : null}
      {range ? (
        <div className="size-guide__control">
          <label className="size-guide__control-label" htmlFor={`${id}-size`}>
            {labels.measure}
          </label>
          <output className="size-guide__readout" htmlFor={`${id}-size`}>
            <span>{current.toFixed(1)}</span>
            <span className="size-guide__unit">{labels.unit}</span>
          </output>
          <input
            className="size-guide__slider"
            type="range"
            id={`${id}-size`}
            min={range.min}
            max={range.max}
            step={0.1}
            value={current}
            onChange={handleChange}
          />
        </div>
      ) : null}
      <ul className="size-guide__cards">
        {sizes.map((size, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: sizes are lines of one text field; two may share a name.
            key={i}
            className={`size-guide__card${i === best ? ' is-match' : ''}`}
          >
            {i === best ? <span className="size-guide__badge">{copy.bestMatch}</span> : null}
            <h3 className="size-guide__name">{size.name}</h3>
            <dl>
              {size.dims ? <Field label={labels.dims}>{size.dims}</Field> : null}
              {size.weight ? <Field label={labels.weight}>{size.weight}</Field> : null}
              {size.measure ? <Field label={labels.measure}>{size.measure}</Field> : null}
              {size.tags.length ? (
                <Field label={labels.tags} grips>
                  {size.tags.map((tag) => (
                    <span className="size-guide__grip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </Field>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
      {note ? <p className="size-guide__note">{note}</p> : null}
    </div>
  )
}

function Field({
  label,
  grips = false,
  children,
}: {
  label: string
  grips?: boolean
  children: ReactNode
}) {
  return (
    <div className="size-guide__field">
      <dt className="size-guide__label">{label}</dt>
      <dd className={`size-guide__value${grips ? ' size-guide__grips' : ''}`}>{children}</dd>
    </div>
  )
}
