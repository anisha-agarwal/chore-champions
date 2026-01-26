import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/quests')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-500 to-blue-500">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Chore Champions
          </h1>
          <p className="text-xl text-purple-100 max-w-2xl mx-auto">
            Turn household tasks into epic quests! Earn points, unlock rewards, and become the ultimate champion of your family.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link
            href="/signup"
            className="bg-white text-purple-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-purple-50 transition shadow-lg text-center"
          >
            Get Started Free
          </Link>
          <Link
            href="/login"
            className="bg-purple-700 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-purple-800 transition shadow-lg text-center"
          >
            Sign In
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Create Quests</h3>
            <p className="text-purple-100">
              Transform boring chores into exciting quests with points and rewards.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Family Fun</h3>
            <p className="text-purple-100">
              Get the whole family involved. Assign tasks and track everyone&apos;s progress.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-purple-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Earn Rewards</h3>
            <p className="text-purple-100">
              Complete quests to earn points and compete for the top spot on the leaderboard.
            </p>
          </div>
        </div>

        <footer className="text-center mt-16 text-purple-200 text-sm">
          <p>Made with love for families everywhere</p>
        </footer>
      </div>
    </div>
  )
}
