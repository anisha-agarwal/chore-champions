'use client'

import { forwardRef, InputHTMLAttributes, useState } from 'react'
import { cn } from '@/lib/utils'

export interface UnderlineInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  helperText?: string
}

const UnderlineInput = forwardRef<HTMLInputElement, UnderlineInputProps>(
  ({ label, helperText, required, id, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false)
    const inputId = id || label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="relative">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            required={required}
            onFocus={(e) => {
              setIsFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setIsFocused(false)
              props.onBlur?.(e)
            }}
            className={cn(
              'w-full py-2 px-0 text-gray-900 bg-transparent border-0 border-b border-gray-200',
              'focus:outline-none focus:ring-0',
              'placeholder:text-gray-400',
              'transition-colors duration-300'
            )}
            {...props}
          />
          {/* Animated underline */}
          <div
            className={cn(
              'absolute bottom-0 left-1/2 h-0.5 bg-purple-600',
              'transition-all duration-300 ease-out',
              isFocused ? 'w-full -translate-x-1/2' : 'w-0 -translate-x-1/2'
            )}
          />
        </div>
        {helperText && (
          <p className="mt-1 text-xs text-gray-500">{helperText}</p>
        )}
      </div>
    )
  }
)

UnderlineInput.displayName = 'UnderlineInput'

export { UnderlineInput }
