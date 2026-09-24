/**
 * Shared visual tokens for transactional email, matching the admin's premium
 * neutral palette. Email clients strip <style> and CSS variables in most
 * inboxes, so every value here is a literal used directly in inline styles.
 */
export const theme = {
  bg: '#f2f2f2',
  card: '#ffffff',
  ink: '#141414',
  muted: '#6b6b6b',
  border: '#e5e5e5',
  radius: '16px',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
} as const
