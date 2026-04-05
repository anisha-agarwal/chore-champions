import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatPanel } from '@/components/chat/chat-panel'
import type { QuickAction } from '@/lib/types'

const PARENT_QUICK_ACTIONS: QuickAction[] = [
  { label: '💡 Suggest quests', prompt: 'Suggest 3 age-appropriate chores for my kids based on their current quests.' },
  { label: '📊 Weekly report', prompt: "Give me a summary of my family's quest progress this week." },
  { label: '🌟 Motivation tips', prompt: 'My kids seem unmotivated lately. What are some strategies to re-engage them?' },
  { label: '🎯 Points balance', prompt: 'How are my kids doing with their points? Any patterns I should know about?' },
]

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'parent') {
    redirect('/quests')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <ChatPanel
        apiEndpoint="/api/ai/chat"
        systemName="Parenting Assistant"
        theme="parent"
        quickActions={PARENT_QUICK_ACTIONS}
      />
    </div>
  )
}
