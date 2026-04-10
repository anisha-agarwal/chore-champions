import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/types'

interface ChatMessageProps {
  message: ChatMessage
  theme: 'parent' | 'kid'
  /** When true, renders the streaming bubble (no timestamp) */
  isStreaming?: boolean
}

export function ChatMessageBubble({ message, theme, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user'

  const assistantBg = theme === 'kid' ? 'bg-green-100 text-green-900' : 'bg-purple-100 text-purple-900'

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-gray-800 text-white rounded-br-sm'
            : cn(assistantBg, 'rounded-bl-sm')
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {!isStreaming && (
          <time
            className={cn(
              'block text-xs mt-1 opacity-60',
              isUser ? 'text-right' : 'text-left'
            )}
            dateTime={message.timestamp}
          >
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
        )}
      </div>
    </div>
  )
}
