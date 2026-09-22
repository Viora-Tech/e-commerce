/** Copy shared by small controls that several sections reuse. */
export const copyButtonContent = {
  copy: (what: string) => `Copy ${what}`,
  copied: (what: string) => `${what} copied`,
} as const
