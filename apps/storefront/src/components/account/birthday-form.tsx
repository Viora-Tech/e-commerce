'use client'

import { type FormEvent, useState, useTransition } from 'react'
import { loyaltyAccountContent } from '@/data/loyalty'
import { saveBirthdayAction } from '@/lib/account-actions'
import {
  ACCOUNT_CARD,
  ACCOUNT_CARD_TITLE,
  ACCOUNT_ERROR,
  ACCOUNT_INTRO,
} from '@/lib/account-classes'
import { CK_INPUT, CK_INPUT_HEIGHT, CK_LABEL } from '@/lib/checkout-classes'
import AccountSubmit from './account-submit'

type BirthdayFormProps = {
  /** Points given on the birthday, for the card's line. */
  birthdayPoints: number
}

const copy = loyaltyAccountContent.birthday

/**
 * "Your birthday" on the Points page, shown until the shopper adds it: a date field and Save.
 * It can be added once; after that the page shows it and the store can change it.
 */
export default function BirthdayForm({ birthdayPoints }: BirthdayFormProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!value) {
      setError(copy.invalid)
      return
    }
    setError(null)
    start(async () => {
      const r = await saveBirthdayAction(value)
      if (!r.ok) setError(r.reason === 'invalid' ? copy.invalid : copy.failed)
    })
  }

  // Render logic
  return (
    <section className={ACCOUNT_CARD} aria-labelledby="points-birthday">
      <div className="flex flex-col gap-1">
        <h2 id="points-birthday" className={ACCOUNT_CARD_TITLE}>
          {copy.title}
        </h2>
        <p className={ACCOUNT_INTRO}>{copy.intro(loyaltyAccountContent.points(birthdayPoints))}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="points-birthday-date" className={CK_LABEL}>
          {copy.label}
        </label>
        <input
          id="points-birthday-date"
          type="date"
          className={`${CK_INPUT} ${CK_INPUT_HEIGHT}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
        />
        {error ? (
          <p className={ACCOUNT_ERROR} role="alert">
            {error}
          </p>
        ) : null}
        <AccountSubmit label={copy.save} pendingLabel={copy.saving} pending={pending} />
      </form>
    </section>
  )
}
