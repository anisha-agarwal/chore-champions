import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/layout/nav-bar'
import { ToasterProvider } from '@/components/ui/toaster-provider'
import { ObservabilityErrorBoundary } from '@/components/error-boundary'
import { PageViewTracker } from '@/components/page-view-tracker'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Ensure user has completed onboarding (has a family)
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <ObservabilityErrorBoundary>
        {children}
      </ObservabilityErrorBoundary>
      <ToasterProvider />
      <PageViewTracker />
      <NavBar role={profile.role} />
    </div>
  )
}
