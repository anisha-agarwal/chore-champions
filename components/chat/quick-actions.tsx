import type { QuickAction } from '@/lib/types'

interface QuickActionsProps {
  actions: QuickAction[]
  onSelect: (prompt: string) => void
  disabled?: boolean
}

export function QuickActions({ actions, onSelect, disabled = false }: QuickActionsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
      role="group"
      aria-label="Quick actions"
    >
      {actions.map(action => (
        <button
          key={action.label}
          type="button"
          onClick={() => onSelect(action.prompt)}
          disabled={disabled}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
