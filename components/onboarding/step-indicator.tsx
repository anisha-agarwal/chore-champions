'use client'

import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  labels: string[]
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1
        const isComplete = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep

        return (
          <div key={stepNumber} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition',
                  isComplete && 'bg-purple-600 text-white',
                  isCurrent && 'border-2 border-purple-600 text-purple-600',
                  !isComplete && !isCurrent && 'border-2 border-gray-300 text-gray-400'
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isComplete ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  stepNumber
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-1 whitespace-nowrap',
                  isCurrent ? 'text-purple-600 font-medium' : 'text-gray-400'
                )}
              >
                {labels[i]}
              </span>
            </div>
            {stepNumber < totalSteps && (
              <div
                className={cn(
                  'w-12 h-0.5 mx-1 mb-5',
                  stepNumber < currentStep ? 'bg-purple-600' : 'bg-gray-300'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
