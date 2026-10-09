import { createContext } from 'react'

export type InspectorTab = 'basic' | 'advanced'

/**
 * Which inspector tab is showing. `all` (the default, outside the tabbed inspector) shows
 * every field, so an unexpected context never hides anything.
 */
export const InspectorTabContext = createContext<InspectorTab | 'all'>('all')
