// TODO: Might use this component later for sub-pages with back navigation
// Uncomment and add tests when needed

/*
'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface StickyHeaderProps {
  title: string
  onBack?: () => void
  rightContent?: ReactNode
  className?: string
}

export function StickyHeader({ title, onBack, rightContent, className }: StickyHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 bg-white border-b border-gray-100',
        'flex items-center justify-between px-4 py-3',
        className
      )}
    >
      <button
        onClick={handleBack}
        className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
        aria-label="Go back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
      </button>

      <h1 className="text-base font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2">
        {title}
      </h1>

      <div className="w-9">
        {rightContent}
      </div>
    </header>
  )
}
*/
