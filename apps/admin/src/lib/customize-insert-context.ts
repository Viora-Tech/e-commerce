import { createContext, useContext } from 'react'
import type { InsertTarget } from './customize-insert'

/**
 * Lets anything inside the editor (the canvas insert line lives inside the
 * preview iframe) ask for the Add section browser at an exact position.
 * `CustomizeLayout` provides it and shows the browser in a dialog in the
 * admin document, so nothing has to be positioned across the iframe edge.
 */
export const InsertContext = createContext<(target: InsertTarget) => void>(() => {})

export const useRequestInsert = () => useContext(InsertContext)
