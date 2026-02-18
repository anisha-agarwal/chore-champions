import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavBar } from '@/components/layout/nav-bar'
import { ToasterProvider } from '@/components/ui/toaster-provider'

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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <ToasterProvider />
      <NavBar />
    </div>
  )
}
