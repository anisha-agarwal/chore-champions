'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="flex items-center">
        <input
          type="checkbox"
          id={id}
          ref={ref}
          className={cn(
            'h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer',
            className
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={id}
            className="ml-2 text-sm text-gray-700 cursor-pointer"
          >
            {label}
          </label>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
