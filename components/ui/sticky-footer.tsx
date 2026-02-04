// TODO: Might use this component later for edit pages with Cancel/Save actions
// Uncomment and add tests when needed

/*
'use client'

import { cn } from '@/lib/utils'
import { Button, ButtonProps } from './button'

export interface StickyFooterProps {
  onCancel: () => void
  onSave: () => void
  cancelLabel?: string
  saveLabel?: string
  saving?: boolean
  saveSuccess?: boolean
  disabled?: boolean
  className?: string
}

export function StickyFooter({
  onCancel,
  onSave,
  cancelLabel = 'Cancel',
  saveLabel = 'Save',
  saving = false,
  saveSuccess = false,
  disabled = false,
  className,
}: StickyFooterProps) {
  return (
    <footer
      className={cn(
        'sticky bottom-0 z-40 bg-white border-t border-gray-100',
        'px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        className
      )}
    >
      <div className="flex gap-3 max-w-md mx-auto">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="flex-1 h-14"
        >
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          variant="primary"
          onClick={onSave}
          loading={saving}
          success={saveSuccess}
          disabled={disabled || saving}
          className="flex-1 h-14"
        >
          {saveLabel}
        </Button>
      </div>
    </footer>
  )
}
*/
