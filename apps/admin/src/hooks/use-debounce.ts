'use client'

import { useEffect, useState } from 'react'

/**
 * Custom hook that debounces a value by delaying its update until after a specified delay period.
 *
 * @template T - The type of the value being debounced
 * @param {T} value - The value to debounce
 * @param {number} [delay=300] - The delay in milliseconds before updating the debounced value (default: 300ms)
 * @returns {T} The debounced value
 *
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   // This will only run 300ms after the user stops typing
 *   if (debouncedSearchTerm) {
 *     fetchSearchResults(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 */
export const useDebounce = <T>(value: T, delay = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
