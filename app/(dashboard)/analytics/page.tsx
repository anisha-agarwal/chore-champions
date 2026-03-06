import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ParentAnalytics } from '@/components/analytics/parent-analytics'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, family_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'parent') redirect('/me')
  if (!profile.family_id) redirect('/family')

  return (
    <div className="min-h-screen bg-white">
      <header className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Family Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Track your family&apos;s quest progress</p>
      </header>
      <main className="px-4 pb-24">
        <div className="max-w-md mx-auto">
          <ParentAnalytics familyId={profile.family_id} userId={user.id} />
        </div>
      </main>
    </div>
  )
}
