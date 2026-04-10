'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { consumeSseStream } from '@/lib/ai/stream-helpers'
import { ChatMessageBubble } from './chat-message'
import { TypingIndicator } from './typing-indicator'
import { QuickActions } from './quick-actions'
import type { ChatMessage, QuickAction } from '@/lib/types'

interface ChatPanelProps {
  apiEndpoint: '/api/ai/chat' | '/api/ai/quest-buddy'
  systemName: string
  theme: 'parent' | 'kid'
  quickActions: QuickAction[]
  /** Kid session cap (number of messages) */
  maxMessages?: number
  conversationId?: string
  initialMessages?: ChatMessage[]
  onConversationCreated?: (id: string) => void
}

export function ChatPanel({
  apiEndpoint,
  systemName,
  theme,
  quickActions,
  maxMessages,
  conversationId: initialConversationId,
  initialMessages = [],
  onConversationCreated,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null)
  const [limitReached, setLimitReached] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isInputDisabled = isStreaming || limitReached

  const headerBg = theme === 'kid'
    ? 'bg-gradient-to-r from-yellow-400 to-pink-500'
    : 'bg-purple-600'

  // Scroll to bottom on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming || limitReached) return

    setError(null)
    setInputValue('')

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }

    // Optimistic update
    setMessages(prev => [...prev, userMessage])
    setIsStreaming(true)
    setStreamingContent('')

    const controller = new AbortController()
    abortRef.current = controller

    const idKey = apiEndpoint === '/api/ai/chat' ? 'conversationId' : 'chatId'

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, [idKey]: conversationId ?? undefined }),
        signal: controller.signal,
      })

      if (!res.ok) {
        // Remove the optimistic user message on error
        setMessages(prev => prev.filter(m => m !== userMessage))
        if (res.status === 429) {
          const data = await res.json() as { error?: string }
          setError(data.error ?? "You've reached the message limit. Try again tomorrow!")
        } else if (res.status === 503) {
          setError('Chat is temporarily unavailable. Please try again in a moment.')
        } else {
          setError("Something went wrong. Please try again.")
        }
        return
      }

      if (!res.body) {
        setMessages(prev => prev.filter(m => m !== userMessage))
        setError('No response received.')
        return
      }

      const fullText = await consumeSseStream(
        res.body,
        (accumulated) => setStreamingContent(accumulated),
        (meta) => {
          const m = meta as { conversationId?: string; chatId?: string; title?: string; limitReached?: boolean }
          const newId = m.conversationId ?? m.chatId ?? null
          if (newId && newId !== conversationId) {
            setConversationId(newId)
            onConversationCreated?.(newId)
          }
          if (m.limitReached) setLimitReached(true)
        },
        controller.signal
      )

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: fullText || '(no response)',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => prev.filter(m => m !== userMessage))
        setError('Connection interrupted. Please try again.')
      }
    } finally {
      setStreamingContent('')
      setIsStreaming(false)
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [apiEndpoint, conversationId, isStreaming, limitReached, onConversationCreated])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(inputValue)
    }
  }

  const showEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className={`${headerBg} text-white px-4 py-3 flex-shrink-0`}>
        <h1 className="text-lg font-bold">{systemName}</h1>
      </header>

      {/* Message area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {showEmpty && (
          <p className="text-center text-gray-500 text-sm mt-8">
            {theme === 'kid'
              ? '👋 Hi! I\'m your Quest Buddy. What do you want to do?'
              : 'Ask me anything about your family\'s quests and progress!'}
          </p>
        )}

        {messages.map((msg, i) => (
          <ChatMessageBubble key={i} message={msg} theme={theme} />
        ))}

        {/* Streaming bubble */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className={`max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2 text-sm leading-relaxed ${theme === 'kid' ? 'bg-green-100 text-green-900' : 'bg-purple-100 text-purple-900'}`}>
              {streamingContent ? (
                <p className="whitespace-pre-wrap break-words">{streamingContent}</p>
              ) : (
                <TypingIndicator />
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Limit reached banner */}
      {limitReached && (
        <div className="mx-4 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 text-center">
          {maxMessages
            ? "That's all for now! Start a new chat anytime 🌟"
            : 'Start a new conversation to continue 💬'}
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 pt-3 pb-4 space-y-2">
        {quickActions.length > 0 && (
          <QuickActions
            actions={quickActions}
            onSelect={(prompt) => {
              setInputValue(prompt)
              inputRef.current?.focus()
            }}
            disabled={isInputDisabled}
          />
        )}

        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isInputDisabled ? '' : 'Type a message…'}
            disabled={isInputDisabled}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-50 disabled:text-gray-400"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            aria-label="Message input"
          />
          <button
            type="button"
            onClick={() => void sendMessage(inputValue)}
            disabled={isInputDisabled || !inputValue.trim()}
            aria-label="Send message"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
