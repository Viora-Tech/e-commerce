'use client'

import dynamic from 'next/dynamic'
import { Input } from './shadcn/input'

/** The country list and flag SVGs load on demand, so pages that only sometimes show a phone field stay small. */
const PhoneInputLazy = dynamic(() => import('./phone-input'), {
  loading: () => <Input size="lg" type="tel" disabled aria-busy="true" />,
})

export default PhoneInputLazy
