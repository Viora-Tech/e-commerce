'use client'

import { createContext } from 'react'

/** The class `RichCopy` gives sanitised copy that reaches it unresolved (`rich-copy-scope.tsx`). */
export const RichCopyClass = createContext<string | undefined>(undefined)
