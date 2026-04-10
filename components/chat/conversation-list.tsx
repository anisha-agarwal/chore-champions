import { cn } from '@/lib/utils'

export interface ConversationSummary {
  id: string
  title: string | null
  updatedAt: string
  messageCount: number
}

interface ConversationListProps {
  conversations: ConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  loading?: boolean
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading = false,
}: ConversationListProps) {
  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6 px-4">
        No conversations yet. Start a new one!
      </p>
    )
  }

  return (
    <ul className="space-y-1 p-2" role="listbox" aria-label="Conversations">
      {conversations.map(convo => (
        <li key={convo.id}>
          <button
            type="button"
            role="option"
            aria-selected={convo.id === activeId}
            onClick={() => onSelect(convo.id)}
            className={cn(
              'w-full text-left rounded-lg px-3 py-2.5 transition',
              convo.id === activeId
                ? 'bg-purple-100 text-purple-900'
                : 'hover:bg-gray-100 text-gray-700'
            )}
          >
            <p className="text-sm font-medium truncate">
              {convo.title ?? 'New conversation'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {convo.messageCount} message{convo.messageCount !== 1 ? 's' : ''} ·{' '}
              {new Date(convo.updatedAt).toLocaleDateString()}
            </p>
          </button>
        </li>
      ))}
    </ul>
  )
}
