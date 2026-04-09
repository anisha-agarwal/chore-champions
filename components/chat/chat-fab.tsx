'use client'

import { useState, useEffect } from 'react'
import { ChatPanel } from './chat-panel'
import type { QuickAction } from '@/lib/types'

const PARENT_QUICK_ACTIONS: QuickAction[] = [
  { label: '💡 Suggest quests', prompt: 'Suggest 3 age-appropriate chores for my kids based on their current quests.' },
  { label: '📊 Weekly report', prompt: "Give me a summary of my family's quest progress this week." },
  { label: '🌟 Motivation tips', prompt: 'My kids seem unmotivated lately. What are some strategies to re-engage them?' },
  { label: '🎯 Points balance', prompt: 'How are my kids doing with their points? Any patterns I should know about?' },
]

const KID_QUICK_ACTIONS: QuickAction[] = [
  { label: '🚀 What should I do?', prompt: 'Which quest should I do next?' },
  { label: '⭐ My points', prompt: 'How many points do I have? What can I get?' },
  { label: '🎉 I finished one!', prompt: 'I just finished a quest! Celebrate with me!' },
  { label: '💪 I need help', prompt: "I'm stuck on a quest. Can you help me?" },
]

interface ChatFabProps {
  role: 'parent' | 'child'
}

export function ChatFab({ role }: ChatFabProps) {
  const [isOpen, setIsOpen] = useState(false)

  const isParent = role === 'parent'

  // Toggle a body class so other floating buttons can hide while chat is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('chat-open')
    } else {
      document.body.classList.remove('chat-open')
    }
    return () => {
      document.body.classList.remove('chat-open')
    }
  }, [isOpen])

  return (
    <>
      {/* Chat window */}
      {isOpen && (
        <>
          {/* Backdrop on mobile */}
          <div
            className="fixed inset-0 bg-black/30 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed z-50 right-4 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden flex flex-col"
            style={{ bottom: '4rem', top: '2rem' }}
          >
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white transition"
              aria-label="Close chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <ChatPanel
              apiEndpoint={isParent ? '/api/ai/chat' : '/api/ai/quest-buddy'}
              systemName={isParent ? 'Parenting Assistant' : 'Quest Buddy'}
              theme={isParent ? 'parent' : 'kid'}
              quickActions={isParent ? PARENT_QUICK_ACTIONS : KID_QUICK_ACTIONS}
              maxMessages={isParent ? undefined : 20}
            />
          </div>
        </>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ bottom: '5rem' }}
        className={`fixed right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          isOpen
            ? 'bg-gray-500 hover:bg-gray-600 rotate-0'
            : isParent
              ? 'bg-purple-600 hover:bg-purple-700'
              : 'bg-gradient-to-br from-yellow-400 to-pink-500 hover:opacity-90'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </>
  )
}
