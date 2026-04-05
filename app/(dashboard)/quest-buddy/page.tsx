import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatPanel } from '@/components/chat/chat-panel'
import type { QuickAction } from '@/lib/types'

const KID_QUICK_ACTIONS: QuickAction[] = [
  { label: '🚀 What should I do?', prompt: 'Which quest should I do next?' },
  { label: '⭐ My points', prompt: 'How many points do I have? What can I get?' },
  { label: '🎉 I finished one!', prompt: 'I just finished a quest! Celebrate with me!' },
  { label: '💪 I need help', prompt: "I'm stuck on a quest. Can you help me?" },
]

export default async function QuestBuddyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <ChatPanel
        apiEndpoint="/api/ai/quest-buddy"
        systemName="Quest Buddy"
        theme="kid"
        quickActions={KID_QUICK_ACTIONS}
        maxMessages={20}
      />
    </div>
  )
}
