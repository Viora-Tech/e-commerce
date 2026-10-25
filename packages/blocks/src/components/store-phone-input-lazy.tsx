'use client'

import { lazy, Suspense } from 'react'
import type { StorePhoneInputProps } from './store-phone-input'

const StorePhoneInput = lazy(() => import('./store-phone-input'))

/** The country list and flag SVGs load on demand, so pages that only sometimes show a phone field stay light. */
export default function StorePhoneInputLazy(props: StorePhoneInputProps) {
  return (
    <Suspense
      fallback={
        <input
          type="tel"
          disabled
          aria-busy="true"
          id={props.id}
          className={`field__input w-full ${props.inputClassName ?? ''}`}
        />
      }
    >
      <StorePhoneInput {...props} />
    </Suspense>
  )
}
