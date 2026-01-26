'use client'

import { cn } from '@/lib/utils'
import { TIME_OF_DAY_OPTIONS } from '@/lib/types'

interface TimeFilterProps {
  selected: string
  onChange: (value: string) => void
}

export function TimeFilter({ selected, onChange }: TimeFilterProps) {
  const options = [{ value: 'all', label: 'All' }, ...TIME_OF_DAY_OPTIONS]

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition',
            selected === option.value
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
