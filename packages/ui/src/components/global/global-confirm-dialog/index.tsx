'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../shadcn/alert-dialog'

type GlobalConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

/**
 * GlobalConfirmDialog - Reusable confirmation dialog
 *
 * A generic confirmation dialog for actions that need user confirmation.
 * Supports destructive variant for dangerous actions.
 */
const GlobalConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}: GlobalConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={loading} className="cursor-pointer">
          {cancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          className={
            variant === 'destructive'
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer'
              : undefined
          }
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Loading...' : confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)

export default GlobalConfirmDialog
