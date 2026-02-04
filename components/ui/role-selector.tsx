'use client'

import { cn } from '@/lib/utils'

const ROLE_OPTIONS = [
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Kid' },
] as const

export type Role = 'parent' | 'child'

interface RoleSelectorProps {
  selected: Role
  onChange: (value: Role) => void
  disabled?: boolean
  size?: 'default' | 'sm'
}

export function RoleSelector({ selected, onChange, disabled, size = 'default' }: RoleSelectorProps) {
  return (
    <div className="flex gap-2">
      {ROLE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={cn(
            'flex-1 rounded-full font-medium transition',
            size === 'sm' ? 'px-6 py-2 text-sm' : 'px-6 py-2 text-sm',
            selected === option.value
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
